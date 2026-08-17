import type { QuitDb } from './db';
import type {
  AchievementRepository,
  CravingRepository,
  PreferencesRepository,
  ProfileRepository,
  ReasonRepository,
  Repositories,
  Snapshot,
} from './repositories';

const SINGLETON_ID = 'singleton';

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
    getAll() {
      return db.cravings.orderBy('startedAt').toArray();
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
    getAll() {
      return db.reasons.orderBy('createdAt').toArray();
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

export function createRepositories(db: QuitDb): Repositories {
  const profile = createProfileRepository(db);
  const cravings = createCravingRepository(db);
  const achievements = createAchievementRepository(db);
  const reasons = createReasonRepository(db);
  const preferences = createPreferencesRepository(db);

  const allTables = [
    db.profile,
    db.cravings,
    db.achievementUnlocks,
    db.reasons,
    db.preferences,
  ];

  return {
    profile,
    cravings,
    achievements,
    reasons,
    preferences,

    readSnapshot(): Promise<Snapshot> {
      return db.transaction('r', allTables, async () => {
        const [profileRow, cravingRows, achievementRows, reasonRows, preferencesRow] =
          await Promise.all([
            db.profile.get(SINGLETON_ID),
            db.cravings.orderBy('startedAt').toArray(),
            db.achievementUnlocks.toArray(),
            db.reasons.orderBy('createdAt').toArray(),
            db.preferences.get(SINGLETON_ID),
          ]);
        return {
          profile: profileRow ?? null,
          cravings: cravingRows,
          achievementUnlocks: achievementRows,
          reasons: reasonRows,
          preferences: preferencesRow ?? null,
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
        ]);
        await Promise.all([
          s.profile ? db.profile.put(s.profile) : Promise.resolve(),
          db.cravings.bulkPut(s.cravings),
          db.achievementUnlocks.bulkPut(s.achievementUnlocks),
          db.reasons.bulkPut(s.reasons),
          s.preferences ? db.preferences.put(s.preferences) : Promise.resolve(),
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
        ]);
      });
    },
  };
}
