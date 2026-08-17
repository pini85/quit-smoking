/**
 * Export/import orchestration. No DOM APIs here — UI handles Blob/download;
 * this module only ever returns/consumes strings and structured data.
 *
 * VALIDATE-THEN-WRITE invariant: `applyImport` takes the ALREADY-validated
 * file produced by `previewImport`; it never parses raw text itself, so a
 * corrupt file can never reach a write.
 */

import { buildExportFile, exportFileName, type ExportFileV1, type ExportSnapshot } from '@/domain/export/format';
import { migrateToLatest, ImportError } from '@/domain/export/migrate';
import { mergeSnapshots, type MergeSummary } from '@/domain/export/merge';
import { validateExportFile } from '@/lib/validation/importSchemas';
import type { Repositories } from '@/lib/persistence/repositories';

export async function exportData(
  repos: Repositories,
  now: Date
): Promise<{ json: string; fileName: string }> {
  const snapshot = await repos.readSnapshot();
  const exportedAt = now.toISOString();
  const file = buildExportFile(snapshot, exportedAt);
  return {
    json: JSON.stringify(file, null, 2),
    fileName: exportFileName(exportedAt),
  };
}

function fileToSnapshot(file: ExportFileV1): ExportSnapshot {
  return {
    profile: file.profile,
    cravings: file.cravings,
    achievementUnlocks: file.achievementUnlocks,
    reasons: file.reasons,
    preferences: file.preferences,
  };
}

const EMPTY_SNAPSHOT: ExportSnapshot = {
  profile: null,
  cravings: [],
  achievementUnlocks: [],
  reasons: [],
  preferences: null,
};

/**
 * Parses, migrates, and validates `rawText`, then computes what merging it
 * into the current DB contents would look like. Performs NO writes.
 */
export async function previewImport(
  repos: Repositories,
  rawText: string
): Promise<{ file: ExportFileV1; summary: MergeSummary }> {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new ImportError('File is not valid JSON.');
  }

  const migrated = migrateToLatest(raw);
  const file = validateExportFile(migrated);

  const current = await repos.readSnapshot();
  const { summary } = mergeSnapshots(current, fileToSnapshot(file));

  return { file, summary };
}

/**
 * Writes an already-validated file (from `previewImport`) into the DB.
 * `merge` unions with current data (current wins on id collision); `replace`
 * discards current data entirely. Both go through a single `replaceAll`
 * call, so each is one atomic transaction.
 */
export async function applyImport(
  repos: Repositories,
  file: ExportFileV1,
  mode: 'merge' | 'replace'
): Promise<MergeSummary> {
  const importedSnapshot = fileToSnapshot(file);

  if (mode === 'replace') {
    const { summary } = mergeSnapshots(EMPTY_SNAPSHOT, importedSnapshot);
    // TODO(export v2): the export format does not carry belief assessments or
    // freedom sessions yet, so they are not part of `importedSnapshot`.
    // `replace` means "discard current data entirely", so they go empty here;
    // the next task teaches the format about both stores.
    await repos.replaceAll({ ...importedSnapshot, beliefAssessments: [], freedomSessions: [] });
    return summary;
  }

  const current = await repos.readSnapshot();
  const { merged, summary } = mergeSnapshots(current, importedSnapshot);
  // Same TODO as above — but `merge` must never destroy data the imported
  // file simply doesn't know about, so the device's own rows are carried
  // through untouched.
  await repos.replaceAll({
    ...merged,
    beliefAssessments: current.beliefAssessments,
    freedomSessions: current.freedomSessions,
  });
  return summary;
}
