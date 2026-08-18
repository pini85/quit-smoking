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
  SleepSession,
} from '@/domain/types';

/**
 * Freezes the SET of collections a schemaVersion-1 file carries. Historical
 * versions get their own snapshot type rather than being folded into the
 * current one: growing `ExportSnapshot` in place would silently redefine what
 * "v1" means and let a v2-only collection into the v1 type with no compile
 * error.
 *
 * The freeze is collection-deep only — the ROW types below are the live
 * domain interfaces, shared with v2, and they do grow (v2 added `beliefId?`
 * to `CravingSession`, so it is visible through this type too). That is
 * deliberate: v1-local copies of five interfaces would be documentation
 * pretending to be a guarantee, since nothing checks them against a real
 * historical file. The actual guardrail for what an old file may contain is
 * the migrate-then-validate pipeline (`MIGRATIONS[1]` works on
 * `Record<string, unknown>`, and only the current schema ever validates),
 * plus the verbatim captured v1 export pinned in `tests/domain/migrate.test.ts`.
 */
export interface ExportSnapshotV1 {
  profile: QuitProfile | null;
  cravings: CravingSession[];
  achievementUnlocks: AchievementUnlock[];
  reasons: PersonalReason[];
  preferences: Preferences | null;
}

/**
 * Freezes the SET of collections a schemaVersion-2 file carries, the same way
 * `ExportSnapshotV1` freezes v1's. `ExportSnapshot` used to BE this shape
 * until sleep/snore monitoring added a sixth collection; giving it its own
 * name here keeps `MIGRATIONS[2]` and the captured v2 fixture in
 * `tests/domain/migrate.test.ts` meaningful against a shape that will never
 * change again.
 */
export interface ExportSnapshotV2 extends ExportSnapshotV1 {
  beliefAssessments: BeliefAssessment[];
  freedomSessions: FreedomSession[];
}

/**
 * The CURRENT snapshot shape (v3). Structurally identical to
 * `lib/persistence/repositories.Snapshot` — see the module doc above.
 */
export interface ExportSnapshot extends ExportSnapshotV2 {
  sleepSessions: SleepSession[];
}

export const CURRENT_EXPORT_VERSION = 3 as const;

export interface ExportFileV1 extends ExportSnapshotV1 {
  schemaVersion: 1;
  app: 'quit-smoking';
  exportedAt: string;
}

export interface ExportFileV2 extends ExportSnapshotV2 {
  schemaVersion: 2;
  app: 'quit-smoking';
  exportedAt: string;
}

export interface ExportFileV3 extends ExportSnapshot {
  schemaVersion: 3;
  app: 'quit-smoking';
  exportedAt: string;
}

// Every version this app can be handed. Only the newest is ever WRITTEN;
// older members exist so migrations have something to name.
export type AnyExportFile = ExportFileV1 | ExportFileV2 | ExportFileV3;

export function buildExportFile(snapshot: ExportSnapshot, exportedAt: string): ExportFileV3 {
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
    sleepSessions: snapshot.sleepSessions,
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
