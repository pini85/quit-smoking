import Dexie, { type Table } from 'dexie';
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

export class QuitDb extends Dexie {
  profile!: Table<QuitProfile, string>;
  cravings!: Table<CravingSession, string>;
  achievementUnlocks!: Table<AchievementUnlock, string>;
  reasons!: Table<PersonalReason, string>;
  preferences!: Table<Preferences, string>;
  beliefAssessments!: Table<BeliefAssessment, string>;
  freedomSessions!: Table<FreedomSession, string>;
  sleepSessions!: Table<SleepSession, string>;

  constructor(name = 'quit-smoking') {
    super(name);
    // Dexie versions are DELTAS and each shipped block is frozen: version(1)
    // is exactly what already exists in users' browsers and must never be
    // edited in place, or their upgrade path silently changes underneath
    // them. New schema goes in a new version() block below.
    this.version(1).stores({
      profile: 'id',
      cravings: 'id, startedAt, trigger, outcome',
      achievementUnlocks: 'id',
      reasons: 'id, createdAt',
      preferences: 'id',
    });
    // v2 adds two brand-new, initially empty stores, so there is nothing to
    // migrate and no upgrade callback is needed. `cravings` is untouched on
    // purpose: `CravingSession.beliefId` (added in the same release) is NOT
    // indexed, and Dexie stores whole rows regardless of which fields the
    // schema names — only queried-by fields need an index entry.
    this.version(2).stores({
      beliefAssessments: 'id, assessedAt, beliefId',
      freedomSessions: 'id, startedAt',
    });
    // v3 adds the sleep/snore store. `startedAt` is indexed for chronological
    // reads; `state` is deliberately NOT indexed — it is only scanned via
    // filter() over a small table during launch recovery (see v2 note on
    // non-indexed fields).
    this.version(3).stores({ sleepSessions: 'id, startedAt' });
  }
}

export function createDb(name?: string): QuitDb {
  return new QuitDb(name);
}
