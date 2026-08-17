/**
 * Export file format — pure types + builders, no I/O.
 *
 * `domain/` may not import from `lib/`, so `ExportSnapshot` is defined here,
 * structurally identical to `lib/persistence/repositories.Snapshot` on
 * purpose: persistence adapts trivially (a `Snapshot` value satisfies
 * `ExportSnapshot`'s shape and vice versa).
 */

import type {
  QuitProfile,
  CravingSession,
  AchievementUnlock,
  PersonalReason,
  Preferences,
} from '@/domain/types';

export interface ExportSnapshot {
  profile: QuitProfile | null;
  cravings: CravingSession[];
  achievementUnlocks: AchievementUnlock[];
  reasons: PersonalReason[];
  preferences: Preferences | null;
}

export const CURRENT_EXPORT_VERSION = 1 as const;

export interface ExportFileV1 extends ExportSnapshot {
  schemaVersion: 1;
  app: 'quit-smoking';
  exportedAt: string;
}

// Union grows with future versions (e.g. `ExportFileV1 | ExportFileV2`).
export type AnyExportFile = ExportFileV1;

export function buildExportFile(snapshot: ExportSnapshot, exportedAt: string): ExportFileV1 {
  return {
    schemaVersion: CURRENT_EXPORT_VERSION,
    app: 'quit-smoking',
    exportedAt,
    profile: snapshot.profile,
    cravings: snapshot.cravings,
    achievementUnlocks: snapshot.achievementUnlocks,
    reasons: snapshot.reasons,
    preferences: snapshot.preferences,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'quit-smoking-export-YYYY-MM-DD.json', using the UTC calendar date. */
export function exportFileName(exportedAt: string): string {
  const d = new Date(exportedAt);
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `quit-smoking-export-${y}-${m}-${day}.json`;
}
