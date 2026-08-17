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
  BeliefAssessment,
  FreedomSession,
} from '@/domain/types';

/**
 * FROZEN. The exact set of collections a schemaVersion-1 file carries.
 *
 * Historical versions get their own snapshot type and are never edited again:
 * a v1 file on someone's disk does not change because the app grew. Growing
 * the live `ExportSnapshot` in place would silently redefine what "v1" means
 * and let a v2-only field leak into the v1 type with no compile error.
 */
export interface ExportSnapshotV1 {
  profile: QuitProfile | null;
  cravings: CravingSession[];
  achievementUnlocks: AchievementUnlock[];
  reasons: PersonalReason[];
  preferences: Preferences | null;
}

/**
 * The CURRENT snapshot shape (v2). Structurally identical to
 * `lib/persistence/repositories.Snapshot` — see the module doc above.
 */
export interface ExportSnapshot extends ExportSnapshotV1 {
  beliefAssessments: BeliefAssessment[];
  freedomSessions: FreedomSession[];
}

export const CURRENT_EXPORT_VERSION = 2 as const;

export interface ExportFileV1 extends ExportSnapshotV1 {
  schemaVersion: 1;
  app: 'quit-smoking';
  exportedAt: string;
}

export interface ExportFileV2 extends ExportSnapshot {
  schemaVersion: 2;
  app: 'quit-smoking';
  exportedAt: string;
}

// Every version this app can be handed. Only the newest is ever WRITTEN;
// older members exist so migrations have something to name.
export type AnyExportFile = ExportFileV1 | ExportFileV2;

export function buildExportFile(snapshot: ExportSnapshot, exportedAt: string): ExportFileV2 {
  return {
    schemaVersion: CURRENT_EXPORT_VERSION,
    app: 'quit-smoking',
    exportedAt,
    profile: snapshot.profile,
    cravings: snapshot.cravings,
    achievementUnlocks: snapshot.achievementUnlocks,
    reasons: snapshot.reasons,
    preferences: snapshot.preferences,
    beliefAssessments: snapshot.beliefAssessments,
    freedomSessions: snapshot.freedomSessions,
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
