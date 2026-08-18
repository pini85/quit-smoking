'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import type { ExportFileV2 } from '@/domain/export/format';
import { ImportError } from '@/domain/export/migrate';
import { applyImport, previewImport } from '@/lib/persistence/exportImport';
import { getAppRepositories } from '@/lib/services/appDb';
import type { DataStore } from '@/lib/services/dataStore';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { showToast } from '@/components/ui/Toast';
import { useMessages, type Messages } from '@/lib/i18n';

export type RestoreBackupProps = { store: DataStore };

function importErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ImportError ? err.reason : fallback;
}

type PluralWord = { one: string; other: string };

function plural(n: number, word: PluralWord): string {
  return `${n} ${n === 1 ? word.one : word.other}`;
}

/**
 * Every collection in the file, counted — zeroes included, which is this
 * line's existing convention ("0 reasons" already appears here today). This is
 * the receipt shown before a REPLACE of an empty device, so it names what the
 * file holds rather than what happens to be non-empty; the belief and freedom
 * counts join on the same terms. A migrated v1 file legitimately reports zero
 * for both — those collections did not exist in v1.
 */
function countLine(file: ExportFileV2, m: Messages['welcome']['restoreBackup']): string {
  const parts = [
    plural(file.cravings.length, m.craving),
    plural(file.reasons.length, m.reason),
    plural(file.achievementUnlocks.length, m.badge),
    plural(file.beliefAssessments.length, m.beliefCheckin),
    plural(file.freedomSessions.length, m.freedomSession),
  ];
  return `${file.profile ? m.profileWord : m.noProfileWord}${parts.join(', ')}.`;
}

/**
 * The way back in for someone reinstalling or moving devices: without this,
 * a returning user's only route past onboarding is to invent a quit date
 * and then import over it from the You screen.
 *
 * REPLACE-only on purpose. This screen only exists while no profile is
 * stored, so "merge" would have nothing to merge with, and the extra choice
 * would just be a decision to make in the one moment the user has no
 * information to make it with. No writes happen until "Restore this backup":
 * `previewImport` parses and validates only (see its own docs), so a corrupt
 * file leaves this empty device exactly as empty as it was.
 */
export function RestoreBackup({ store }: RestoreBackupProps) {
  const m = useMessages();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ExportFileV2 | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    // Reset immediately so re-selecting the same file later still fires `change`.
    event.target.value = '';
    if (!picked) return;

    try {
      const text = await picked.text();
      const { file } = await previewImport(getAppRepositories(), text);
      setPending(file);
    } catch (err) {
      console.error('Unsmoke: failed to read backup file', err);
      showToast(importErrorMessage(err, m.welcome.restoreBackup.couldNotRead));
    }
  }

  async function handleRestore() {
    if (!pending || restoring) return;
    setRestoring(true);
    try {
      await applyImport(getAppRepositories(), pending, 'replace');
      // Publishes the restored profile to every subscriber — `AppGate` sees
      // it and redirects off /welcome on its own, so there is no navigation
      // to do here.
      await store.refresh();
      setPending(null);
      setOpen(false);
      showToast(m.welcome.restoreBackup.restored, { withRingPulse: true });
      // `restoring` is deliberately left true: this screen is on its way out.
    } catch (err) {
      console.error('Unsmoke: failed to restore backup', err);
      showToast(importErrorMessage(err, m.welcome.restoreBackup.couldNotRestore));
      setRestoring(false);
    }
  }

  function closeSheet() {
    if (restoring) return;
    setOpen(false);
    setPending(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 self-center px-2 text-[13px] text-ink-muted underline underline-offset-4"
      >
        {m.welcome.restoreBackup.link}
      </button>

      <Sheet open={open} onClose={closeSheet} title={m.welcome.restoreBackup.sheetTitle}>
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[14px] leading-relaxed text-ink-muted">
            {m.welcome.restoreBackup.sheetBody}
          </p>

          {pending ? (
            <>
              <p className="rounded-card bg-surface-raised px-3 py-2 text-[13px] leading-relaxed text-ink">
                {countLine(pending, m.welcome.restoreBackup)}
              </p>
              <Button fullWidth onClick={() => void handleRestore()} disabled={restoring}>
                {restoring
                  ? m.welcome.restoreBackup.restoring
                  : m.welcome.restoreBackup.restoreThisBackup}
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => fileInputRef.current?.click()}
            >
              {m.welcome.restoreBackup.chooseFile}
            </Button>
          )}
        </div>
      </Sheet>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={(event) => void handleFileChange(event)}
        className="hidden"
        aria-label={m.welcome.restoreBackup.fileAriaLabel}
      />
    </>
  );
}

export default RestoreBackup;
