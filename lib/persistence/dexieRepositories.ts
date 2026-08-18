import type { QuitDb } from './db';
import type {
  AchievementRepository,
  BeliefAssessmentRepository,
  CravingRepository,
  FreedomSessionRepository,
  PreferencesRepository,
  ProfileRepository,
  ReasonRepository,
  Repositories,
  Snapshot,
} from './repositories';

const SINGLETON_ID = 'singleton';

// `startedAt` / `createdAt` are ISO 8601 strings WITH a timezone offset, so
// two records can carry different offsets. Dexie's `orderBy()` on a string
// index compares code units, which is NOT chronological order across
// differing offsets (e.g. "...T02:00:00-08:00" == 10:00 UTC sorts before
// "...T10:00:00+09:00" == 01:00 UTC as strings, even though it's later in
// time). Every chronological sort in this module goes through this one
// helper so all call sites agree on what "ascending" means.
function sortChronologically<T>(items: T[], isoField: (item: T) => string): T[] {
  return [...items].sort(
    (a, b) => new Date(isoField(a)).getTime() - new Date(isoField(b)).getTime()
  );
}

function createProfileRepository(db: QuitDb): ProfileRepository {
  return {
    get() {
      return db.profile.get(SINGLETON_ID);
    },
    async save(p) {
      await db.profile.put(p);
    },
  };
}

function createCravingRepository(db: QuitDb): CravingRepository {
  return {
    async add(s) {
      await db.cravings.add(s);
    },
    async update(s) {
      await db.cravings.put(s);
    },
    get(id) {
      return db.cravings.get(id);
    },
    async getAll() {
      const rows = await db.cravings.toArray();
      return sortChronologically(rows, (c) => c.startedAt);
    },
    getOpen() {
      return db.cravings.filter((c) => c.outcome == null).toArray();
    },
    async bulkPut(s) {
      await db.cravings.bulkPut(s);
    },
  };
}

function createAchievementRepository(db: QuitDb): AchievementRepository {
  return {
    getUnlocks() {
      return db.achievementUnlocks.toArray();
    },
    async addUnlocks(u) {
      // bulkPut upserts by primary key (`id`), so unlocking the same
      // achievement twice collapses to a single row — idempotent by design.
      await db.achievementUnlocks.bulkPut(u);
    },
  };
}

function createReasonRepository(db: QuitDb): ReasonRepository {
  return {
    async getAll() {
      const rows = await db.reasons.toArray();
      return sortChronologically(rows, (r) => r.createdAt);
    },
    async add(r) {
      await db.reasons.add(r);
    },
    async update(r) {
      await db.reasons.put(r);
    },
    async remove(id) {
      await db.reasons.delete(id);
    },
    async bulkPut(r) {
      await db.reasons.bulkPut(r);
    },
  };
}

function createPreferencesRepository(db: QuitDb): PreferencesRepository {
  return {
    get() {
      return db.preferences.get(SINGLETON_ID);
    },
    async save(p) {
      await db.preferences.put(p);
    },
  };
}

function createBeliefAssessmentRepository(db: QuitDb): BeliefAssessmentRepository {
  return {
    async add(a) {
      await db.beliefAssessments.add(a);
    },
    async getAll() {
      const rows = await db.beliefAssessments.toArray();
      return sortChronologically(rows, (a) => a.assessedAt);
    },
    async bulkPut(a) {
      await db.beliefAssessments.bulkPut(a);
    },
  };
}

function createFreedomSessionRepository(db: QuitDb): FreedomSessionRepository {
  return {
    async add(s) {
      await db.freedomSessions.add(s);
    },
    async getAll() {
      const rows = await db.freedomSessions.toArray();
      return sortChronologically(rows, (s) => s.startedAt);
    },
    async bulkPut(s) {
      await db.freedomSessions.bulkPut(s);
    },
  };
}

export function createRepositories(db: QuitDb): Repositories {
  const profile = createProfileRepository(db);
  const cravings = createCravingRepository(db);
  const achievements = createAchievementRepository(db);
  const reasons = createReasonRepository(db);
  const preferences = createPreferencesRepository(db);
  const beliefAssessments = createBeliefAssessmentRepository(db);
  const freedomSessions = createFreedomSessionRepository(db);

  const allTables = [
    db.profile,
    db.cravings,
    db.achievementUnlocks,
    db.reasons,
    db.preferences,
    db.beliefAssessments,
    db.freedomSessions,
  ];

  return {
    profile,
    cravings,
    achievements,
    reasons,
    preferences,
    beliefAssessments,
    freedomSessions,

    readSnapshot(): Promise<Snapshot> {
      return db.transaction('r', allTables, async () => {
        const [
          profileRow,
          cravingRows,
          achievementRows,
          reasonRows,
          preferencesRow,
          assessmentRows,
          freedomRows,
        ] = await Promise.all([
          db.profile.get(SINGLETON_ID),
          db.cravings.toArray(),
          db.achievementUnlocks.toArray(),
          db.reasons.toArray(),
          db.preferences.get(SINGLETON_ID),
          db.beliefAssessments.toArray(),
          db.freedomSessions.toArray(),
        ]);
        return {
          profile: profileRow ?? null,
          cravings: sortChronologically(cravingRows, (c) => c.startedAt),
          achievementUnlocks: achievementRows,
          reasons: sortChronologically(reasonRows, (r) => r.createdAt),
          preferences: preferencesRow ?? null,
          beliefAssessments: sortChronologically(assessmentRows, (a) => a.assessedAt),
          freedomSessions: sortChronologically(freedomRows, (s) => s.startedAt),
        };
      });
    },

    replaceAll(s: Snapshot): Promise<void> {
      // Runs entirely inside one Dexie transaction: if any write below
      // throws, Dexie aborts the WHOLE transaction (including the clears
      // that already ran), leaving the prior contents of every store
      // untouched. We never catch here — a failure must propagate to the
      // caller, not be swallowed.
      return db.transaction('rw', allTables, async () => {
        await Promise.all([
          db.profile.clear(),
          db.cravings.clear(),
          db.achievementUnlocks.clear(),
          db.reasons.clear(),
          db.preferences.clear(),
          db.beliefAssessments.clear(),
          db.freedomSessions.clear(),
        ]);
        await Promise.all([
          s.profile ? db.profile.put(s.profile) : Promise.resolve(),
          db.cravings.bulkPut(s.cravings),
          db.achievementUnlocks.bulkPut(s.achievementUnlocks),
          db.reasons.bulkPut(s.reasons),
          s.preferences ? db.preferences.put(s.preferences) : Promise.resolve(),
          db.beliefAssessments.bulkPut(s.beliefAssessments),
          db.freedomSessions.bulkPut(s.freedomSessions),
        ]);
      });
    },

    clearAll(): Promise<void> {
      return db.transaction('rw', allTables, async () => {
        await Promise.all([
          db.profile.clear(),
          db.cravings.clear(),
          db.achievementUnlocks.clear(),
          db.reasons.clear(),
          db.preferences.clear(),
          db.beliefAssessments.clear(),
          db.freedomSessions.clear(),
        ]);
      });
    },
  };
}
