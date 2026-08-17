'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import type { CravingSession, Preferences } from '@/domain/types';
import type { ExportFileV1 } from '@/domain/export/format';
import type { MergeSummary } from '@/domain/export/merge';
import { ImportError } from '@/domain/export/migrate';
import { exportData, previewImport, applyImport } from '@/lib/persistence/exportImport';
import { getAppRepositories } from '@/lib/services/appDb';
import type { DataStore } from '@/lib/services/dataStore';
import { toLocalIso } from '@/lib/utils/iso';
import { defaultPreferences } from '@/lib/utils/preferences';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { showToast } from '@/components/ui/Toast';

export type DataSectionProps = {
  preferences: Preferences | null;
  cravings: CravingSession[];
  store: DataStore;
  now: Date;
};

const THIRTY_DAYS_MS = 30 * 86_400_000;
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Downloads a fresh export and records `lastExportAt`. Exported so
 * `DangerZone`'s "Export first" shortcut can reuse the exact same behaviour
 * ahead of an erase, rather than reimplementing the Blob dance.
 */
export async function runExport(store: DataStore, preferences: Preferences | null): Promise<void> {
  const repos = getAppRepositories();
  const now = new Date();
  const { json, fileName } = await exportData(repos, now);

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);

  const base = preferences ?? defaultPreferences(now);
  await store.savePreferences({ ...base, lastExportAt: toLocalIso(now), updatedAt: toLocalIso(now) });
}

function importErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ImportError ? err.reason : fallback;
}

type PendingImport = { file: ExportFileV1; summary: MergeSummary };

/**
 * Export/import UI. `previewImport` never writes (see its own docs); only
 * `applyImport`, gated behind the mode choice (and a second confirm for
 * replace), touches the database.
 */
export function DataSection({ preferences, cravings, store, now }: DataSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [importing, setImporting] = useState(false);

  const lastExportAt = preferences?.lastExportAt ?? null;
  const staleExport =
    cravings.length > 0 &&
    (lastExportAt === null || now.getTime() - new Date(lastExportAt).getTime() > THIRTY_DAYS_MS);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      await runExport(store, preferences);
      showToast('Exported');
    } catch (err) {
      console.error('Unsmoke: failed to export data', err);
      showToast("Couldn't export — please try again.");
    } finally {
      setExporting(false);
    }
  }

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so re-selecting the same file later still fires `change`.
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const repos = getAppRepositories();
      const { file: parsedFile, summary } = await previewImport(repos, text);
      setConfirmingReplace(false);
      setPending({ file: parsedFile, summary });
    } catch (err) {
      console.error('Unsmoke: failed to read import file', err);
      showToast(importErrorMessage(err, 'Could not read that file.'));
    }
  }

  async function runImport(mode: 'merge' | 'replace') {
    if (!pending || importing) return;
    setImporting(true);
    try {
      const repos = getAppRepositories();
      const summary = await applyImport(repos, pending.file, mode);
      await store.refresh();
      setPending(null);
      setConfirmingReplace(false);
      const parts = [`${summary.newCravings} new craving${summary.newCravings === 1 ? '' : 's'}`];
      if (summary.profileAdopted) parts.push('profile adopted');
      showToast(`Imported — ${parts.join(', ')}.`);
    } catch (err) {
      console.error('Unsmoke: failed to apply import', err);
      showToast(importErrorMessage(err, 'Could not import that file.'));
    } finally {
      setImporting(false);
    }
  }

  function closeImportSheet() {
    setPending(null);
    setConfirmingReplace(false);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Your data</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          No account exists. This file IS your backup.
        </p>
        {lastExportAt ? (
          <p className="mt-1 text-[12px] text-ink-faint">
            Last export: {dateTimeFmt.format(new Date(lastExportAt))}
          </p>
        ) : null}
        {staleExport ? (
          <p className="mt-2 rounded-card bg-accent-soft px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
            It&apos;s been a while — export a fresh backup.
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" fullWidth onClick={() => void handleExport()} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export'}
        </Button>
        <Button variant="secondary" fullWidth onClick={handlePickFile}>
          Import
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={(event) => void handleFileChange(event)}
        className="hidden"
        aria-label="Choose a backup file to import"
      />

      <Sheet open={pending !== null} onClose={closeImportSheet} title="Import backup">
        {pending ? (
          <div className="flex flex-col gap-4 pb-2">
            <p className="text-[14px] leading-relaxed text-ink">
              {pending.file.cravings.length} craving{pending.file.cravings.length === 1 ? '' : 's'} in
              file, {pending.summary.newCravings} new to this device.
              {pending.summary.profileAdopted
                ? ' No profile on this device yet — the file’s profile will be adopted.'
                : ''}
            </p>

            {!confirmingReplace ? (
              <div className="flex flex-col gap-2">
                <Button fullWidth onClick={() => void runImport('merge')} disabled={importing}>
                  Merge (recommended)
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setConfirmingReplace(true)}
                  disabled={importing}
                >
                  Replace everything on this device
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  This overwrites this device&apos;s history with the file. Sure?
                </p>
                <Button fullWidth onClick={() => void runImport('replace')} disabled={importing}>
                  {importing ? 'Replacing…' : 'Yes, replace'}
                </Button>
                <Button variant="ghost" fullWidth onClick={() => setConfirmingReplace(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Sheet>
    </Card>
  );
}

export default DataSection;
