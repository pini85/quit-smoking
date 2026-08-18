'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import type { CravingSession, Preferences } from '@/domain/types';
import type { ExportFileV3 } from '@/domain/export/format';
import type { MergeSummary } from '@/domain/export/merge';
import { ImportError } from '@/domain/export/migrate';
import { exportData, previewImport, applyImport } from '@/lib/persistence/exportImport';
import { getAppRepositories } from '@/lib/services/appDb';
import type { DataStore } from '@/lib/services/dataStore';
import { toLocalIso } from '@/lib/utils/iso';
import { defaultPreferences } from '@/lib/utils/preferences';
import { interpolate, useLocale, useMessages, type Messages } from '@/lib/i18n';
import { dateFmt } from '@/lib/i18n/fmt';
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

type PluralWord = { one: string; other: string };

function plural(n: number, word: PluralWord): string {
  return `${n} ${n === 1 ? word.one : word.other}`;
}

/**
 * "3 belief check-ins and 1 freedom session", or `null` when the file brings
 * neither. Named only when non-zero, matching how the sentence above it
 * already treats the adopted profile — a v1 backup carries no belief or
 * freedom rows at all, and announcing two zeroes would just be noise.
 */
function newFreedomWork(
  summary: MergeSummary,
  m: Messages['you']['data'],
  andJoiner: string
): string | null {
  const parts: string[] = [];
  if (summary.newBeliefAssessments > 0) {
    parts.push(plural(summary.newBeliefAssessments, m.newBeliefCheckin));
  }
  if (summary.newFreedomSessions > 0) {
    parts.push(plural(summary.newFreedomSessions, m.newFreedomSession));
  }
  return parts.length > 0 ? parts.join(andJoiner) : null;
}

type PendingImport = { file: ExportFileV3; summary: MergeSummary };

/**
 * Export/import UI. `previewImport` never writes (see its own docs); only
 * `applyImport`, gated behind the mode choice (and a second confirm for
 * replace), touches the database.
 */
export function DataSection({ preferences, cravings, store, now }: DataSectionProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [importing, setImporting] = useState(false);

  const pendingFreedomWork = pending
    ? newFreedomWork(pending.summary, m.you.data, m.common.andJoiner)
    : null;
  const lastExportAt = preferences?.lastExportAt ?? null;
  const staleExport =
    cravings.length > 0 &&
    (lastExportAt === null || now.getTime() - new Date(lastExportAt).getTime() > THIRTY_DAYS_MS);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      await runExport(store, preferences);
      showToast(m.you.data.exported);
    } catch (err) {
      console.error('Unsmoke: failed to export data', err);
      showToast(m.you.data.couldNotExport);
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
      showToast(importErrorMessage(err, m.you.data.couldNotRead));
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
      const parts = [plural(summary.newCravings, m.you.data.newCraving)];
      const freedomWork = newFreedomWork(summary, m.you.data, m.common.andJoiner);
      if (freedomWork) parts.push(freedomWork);
      if (summary.profileAdopted) parts.push(m.you.data.profileAdopted);
      showToast(interpolate(m.you.data.imported, { parts: parts.join(', ') }));
    } catch (err) {
      console.error('Unsmoke: failed to apply import', err);
      showToast(importErrorMessage(err, m.you.data.couldNotImport));
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
        <h2 className="text-[15px] font-semibold text-ink">{m.you.data.title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          {m.you.data.noAccountNote}
        </p>
        {lastExportAt ? (
          <p className="mt-1 text-[12px] text-ink-faint">
            {interpolate(m.you.data.lastExport, {
              date: dateFmt(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(lastExportAt)
              ),
            })}
          </p>
        ) : null}
        {staleExport ? (
          <p className="mt-2 rounded-card bg-accent-soft px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
            {m.you.data.staleExportNote}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" fullWidth onClick={() => void handleExport()} disabled={exporting}>
          {exporting ? m.you.data.exporting : m.you.data.export}
        </Button>
        <Button variant="secondary" fullWidth onClick={handlePickFile}>
          {m.you.data.import}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={(event) => void handleFileChange(event)}
        className="hidden"
        aria-label={m.you.data.importAriaLabel}
      />

      <Sheet open={pending !== null} onClose={closeImportSheet} title={m.you.data.sheetTitle}>
        {pending ? (
          <div className="flex flex-col gap-4 pb-2">
            <p className="text-[14px] leading-relaxed text-ink">
              {interpolate(m.you.data.cravingsInFile, {
                count: pending.file.cravings.length,
                craving:
                  pending.file.cravings.length === 1
                    ? m.you.data.cravingWord.one
                    : m.you.data.cravingWord.other,
                newCount: pending.summary.newCravings,
              })}
              {pendingFreedomWork
                ? interpolate(m.you.data.alsoNewHere, { work: pendingFreedomWork })
                : ''}
              {pending.summary.profileAdopted ? m.you.data.noProfileYet : ''}
            </p>

            {!confirmingReplace ? (
              <div className="flex flex-col gap-2">
                <Button fullWidth onClick={() => void runImport('merge')} disabled={importing}>
                  {m.you.data.merge}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setConfirmingReplace(true)}
                  disabled={importing}
                >
                  {m.you.data.replaceEverything}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] leading-relaxed text-ink-muted">
                  {m.you.data.overwriteWarning}
                </p>
                <Button fullWidth onClick={() => void runImport('replace')} disabled={importing}>
                  {importing ? m.you.data.replacing : m.you.data.yesReplace}
                </Button>
                <Button variant="ghost" fullWidth onClick={() => setConfirmingReplace(false)}>
                  {m.you.data.cancel}
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
