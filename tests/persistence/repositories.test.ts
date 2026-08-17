import { afterEach, describe, expect, it } from 'vitest';
import { createDb, type QuitDb } from '@/lib/persistence/db';
import { createRepositories } from '@/lib/persistence/dexieRepositories';
import type {
  AchievementUnlock,
  CravingSession,
  PersonalReason,
  Preferences,
  QuitProfile,
} from '@/domain/types';

// Every test gets its own isolated fake-indexeddb database so state never
// leaks across tests. Track open DBs and close+delete them after each test.
const openDbs: QuitDb[] = [];

function freshDb(): QuitDb {
  const db = createDb(`test-${crypto.randomUUID()}`);
  openDbs.push(db);
  return db;
}

afterEach(async () => {
  while (openDbs.length > 0) {
    const db = openDbs.pop()!;
    db.close();
    await db.delete();
  }
});

function makeProfile(overrides: Partial<QuitProfile> = {}): QuitProfile {
  return {
    id: 'singleton',
    quitAt: '2026-01-01T08:00:00Z',
    cigarettesPerDay: 20,
    cigarettesPerPack: 20,
    packPrice: 10,
    currency: 'EUR',
    createdAt: '2026-01-01T08:00:00Z',
    updatedAt: '2026-01-01T08:00:00Z',
    ...overrides,
  };
}

function makeCraving(overrides: Partial<CravingSession> = {}): CravingSession {
  return {
    id: crypto.randomUUID(),
    startedAt: '2026-01-01T08:00:00Z',
    initialIntensity: 5,
    outcome: null,
    ...overrides,
  };
}

function makeReason(overrides: Partial<PersonalReason> = {}): PersonalReason {
  return {
    id: crypto.randomUUID(),
    text: 'For my health',
    createdAt: '2026-01-01T08:00:00Z',
    ...overrides,
  };
}

function makePreferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    id: 'singleton',
    theme: 'system',
    showEmergingEvidence: true,
    updatedAt: '2026-01-01T08:00:00Z',
    ...overrides,
  };
}

function makeUnlock(overrides: Partial<AchievementUnlock> = {}): AchievementUnlock {
  return {
    id: 'first-day',
    unlockedAt: '2026-01-02T08:00:00Z',
    ...overrides,
  };
}

describe('ProfileRepository', () => {
  it('returns undefined when no profile has been saved', async () => {
    const repos = createRepositories(freshDb());
    expect(await repos.profile.get()).toBeUndefined();
  });

  it('roundtrips a saved profile, including update-in-place', async () => {
    const repos = createRepositories(freshDb());
    const profile = makeProfile();
    await repos.profile.save(profile);
    expect(await repos.profile.get()).toEqual(profile);

    const updated = makeProfile({ cigarettesPerDay: 15, updatedAt: '2026-01-03T08:00:00Z' });
    await repos.profile.save(updated);
    expect(await repos.profile.get()).toEqual(updated);
  });
});

describe('CravingRepository', () => {
  it('adds and retrieves a session by id', async () => {
    const repos = createRepositories(freshDb());
    const session = makeCraving();
    await repos.cravings.add(session);
    expect(await repos.cravings.get(session.id)).toEqual(session);
  });

  it('returns undefined for a missing id', async () => {
    const repos = createRepositories(freshDb());
    expect(await repos.cravings.get('nope')).toBeUndefined();
  });

  it('update replaces the full record (full put by id)', async () => {
    const repos = createRepositories(freshDb());
    const session = makeCraving({ outcome: null });
    await repos.cravings.add(session);

    const resolved: CravingSession = {
      ...session,
      outcome: 'passed',
      finalIntensity: 2,
      endedAt: '2026-01-01T08:10:00Z',
    };
    await repos.cravings.update(resolved);

    expect(await repos.cravings.get(session.id)).toEqual(resolved);
  });

  it('getAll returns every session sorted by startedAt ascending, regardless of insert order', async () => {
    const repos = createRepositories(freshDb());
    const late = makeCraving({ startedAt: '2026-01-03T08:00:00Z' });
    const early = makeCraving({ startedAt: '2026-01-01T08:00:00Z' });
    const mid = makeCraving({ startedAt: '2026-01-02T08:00:00Z' });

    // Insert deliberately out of chronological order.
    await repos.cravings.add(late);
    await repos.cravings.add(early);
    await repos.cravings.add(mid);

    const all = await repos.cravings.getAll();
    expect(all.map((c) => c.id)).toEqual([early.id, mid.id, late.id]);
  });

  it('getOpen returns only sessions with outcome == null', async () => {
    const repos = createRepositories(freshDb());
    const open1 = makeCraving({ outcome: null });
    const open2 = makeCraving({ outcome: null });
    const resolved = makeCraving({ outcome: 'smoked', finalIntensity: 8 });
    const unresolved = makeCraving({ outcome: 'unresolved', finalIntensity: 3 });

    await repos.cravings.bulkPut([open1, open2, resolved, unresolved]);

    const open = await repos.cravings.getOpen();
    expect(open.map((c) => c.id).sort()).toEqual([open1.id, open2.id].sort());
  });

  it('bulkPut upserts by id (re-adding same id overwrites, does not duplicate)', async () => {
    const repos = createRepositories(freshDb());
    const session = makeCraving({ initialIntensity: 4 });
    await repos.cravings.bulkPut([session]);
    await repos.cravings.bulkPut([{ ...session, initialIntensity: 9 }]);

    const all = await repos.cravings.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].initialIntensity).toBe(9);
  });
});

describe('AchievementRepository', () => {
  it('getUnlocks returns an empty array when nothing is unlocked', async () => {
    const repos = createRepositories(freshDb());
    expect(await repos.achievements.getUnlocks()).toEqual([]);
  });

  it('addUnlocks is idempotent: unlocking the same id twice yields one row', async () => {
    const repos = createRepositories(freshDb());
    const unlock = makeUnlock();
    await repos.achievements.addUnlocks([unlock]);
    await repos.achievements.addUnlocks([unlock]);

    const unlocks = await repos.achievements.getUnlocks();
    expect(unlocks).toHaveLength(1);
    expect(unlocks[0]).toEqual(unlock);
  });

  it('addUnlocks can add multiple distinct achievements at once', async () => {
    const repos = createRepositories(freshDb());
    const a = makeUnlock({ id: 'a' });
    const b = makeUnlock({ id: 'b' });
    await repos.achievements.addUnlocks([a, b]);

    const unlocks = await repos.achievements.getUnlocks();
    expect(unlocks.map((u) => u.id).sort()).toEqual(['a', 'b']);
  });
});

describe('ReasonRepository', () => {
  it('CRUD roundtrip: add, update, remove', async () => {
    const repos = createRepositories(freshDb());
    const reason = makeReason();
    await repos.reasons.add(reason);
    expect(await repos.reasons.getAll()).toEqual([reason]);

    const updated = { ...reason, text: 'For my family', archived: true };
    await repos.reasons.update(updated);
    expect(await repos.reasons.getAll()).toEqual([updated]);

    await repos.reasons.remove(reason.id);
    expect(await repos.reasons.getAll()).toEqual([]);
  });

  it('getAll sorts by createdAt ascending', async () => {
    const repos = createRepositories(freshDb());
    const late = makeReason({ createdAt: '2026-01-03T08:00:00Z' });
    const early = makeReason({ createdAt: '2026-01-01T08:00:00Z' });
    const mid = makeReason({ createdAt: '2026-01-02T08:00:00Z' });

    await repos.reasons.bulkPut([late, early, mid]);

    const all = await repos.reasons.getAll();
    expect(all.map((r) => r.id)).toEqual([early.id, mid.id, late.id]);
  });

  it('bulkPut upserts by id', async () => {
    const repos = createRepositories(freshDb());
    const reason = makeReason();
    await repos.reasons.bulkPut([reason]);
    await repos.reasons.bulkPut([{ ...reason, text: 'Updated text' }]);

    const all = await repos.reasons.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].text).toBe('Updated text');
  });
});

describe('PreferencesRepository', () => {
  it('returns undefined when nothing saved, then roundtrips a save', async () => {
    const repos = createRepositories(freshDb());
    expect(await repos.preferences.get()).toBeUndefined();

    const prefs = makePreferences();
    await repos.preferences.save(prefs);
    expect(await repos.preferences.get()).toEqual(prefs);

    const updated = makePreferences({ theme: 'dark', updatedAt: '2026-01-05T08:00:00Z' });
    await repos.preferences.save(updated);
    expect(await repos.preferences.get()).toEqual(updated);
  });
});

describe('readSnapshot', () => {
  it('returns nulls/empty arrays for an empty database', async () => {
    const repos = createRepositories(freshDb());
    const snapshot = await repos.readSnapshot();
    expect(snapshot).toEqual({
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });
  });

  it('returns a single consistent read across all five stores', async () => {
    const repos = createRepositories(freshDb());
    const profile = makeProfile();
    const craving = makeCraving();
    const unlock = makeUnlock();
    const reason = makeReason();
    const prefs = makePreferences();

    await repos.profile.save(profile);
    await repos.cravings.add(craving);
    await repos.achievements.addUnlocks([unlock]);
    await repos.reasons.add(reason);
    await repos.preferences.save(prefs);

    const snapshot = await repos.readSnapshot();
    expect(snapshot).toEqual({
      profile,
      cravings: [craving],
      achievementUnlocks: [unlock],
      reasons: [reason],
      preferences: prefs,
    });
  });
});

describe('replaceAll', () => {
  it('atomically swaps entire contents: old rows gone, new rows present', async () => {
    const repos = createRepositories(freshDb());
    // Seed with data that must be wiped.
    await repos.profile.save(makeProfile());
    const staleCraving = makeCraving();
    await repos.cravings.add(staleCraving);
    await repos.achievements.addUnlocks([makeUnlock({ id: 'stale' })]);
    await repos.reasons.add(makeReason());
    await repos.preferences.save(makePreferences());

    const newProfile = makeProfile({ cigarettesPerDay: 5 });
    const newCraving = makeCraving();
    const newUnlock = makeUnlock({ id: 'fresh' });
    const newReason = makeReason({ text: 'Fresh reason' });
    const newPrefs = makePreferences({ theme: 'light' });

    await repos.replaceAll({
      profile: newProfile,
      cravings: [newCraving],
      achievementUnlocks: [newUnlock],
      reasons: [newReason],
      preferences: newPrefs,
    });

    const snapshot = await repos.readSnapshot();
    expect(snapshot).toEqual({
      profile: newProfile,
      cravings: [newCraving],
      achievementUnlocks: [newUnlock],
      reasons: [newReason],
      preferences: newPrefs,
    });
  });

  it('replacing with an empty snapshot clears every store', async () => {
    const repos = createRepositories(freshDb());
    await repos.profile.save(makeProfile());
    await repos.cravings.add(makeCraving());
    await repos.achievements.addUnlocks([makeUnlock()]);
    await repos.reasons.add(makeReason());
    await repos.preferences.save(makePreferences());

    await repos.replaceAll({
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });

    expect(await repos.readSnapshot()).toEqual({
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });
  });

  it('aborts the whole transaction on a mid-write failure, leaving prior data intact', async () => {
    const repos = createRepositories(freshDb());
    const originalProfile = makeProfile();
    const originalCraving = makeCraving();
    const originalUnlock = makeUnlock();
    const originalReason = makeReason();
    const originalPrefs = makePreferences();

    await repos.profile.save(originalProfile);
    await repos.cravings.add(originalCraving);
    await repos.achievements.addUnlocks([originalUnlock]);
    await repos.reasons.add(originalReason);
    await repos.preferences.save(originalPrefs);

    // A function value is not structured-cloneable, so IndexedDB rejects the
    // write with a DataCloneError partway through the transaction. This
    // forces Dexie to abort the entire transaction, including the clears
    // that already ran.
    const poisonedReason = {
      ...makeReason(),
      poison: () => {
        /* not structured-cloneable */
      },
    } as unknown as PersonalReason;

    await expect(
      repos.replaceAll({
        profile: makeProfile({ cigarettesPerDay: 999 }),
        cravings: [],
        achievementUnlocks: [],
        reasons: [poisonedReason],
        preferences: null,
      })
    ).rejects.toBeTruthy();

    // Original data across ALL stores must still be there — the clears that
    // ran earlier in the same transaction were rolled back too.
    const snapshot = await repos.readSnapshot();
    expect(snapshot).toEqual({
      profile: originalProfile,
      cravings: [originalCraving],
      achievementUnlocks: [originalUnlock],
      reasons: [originalReason],
      preferences: originalPrefs,
    });
  });
});

describe('clearAll', () => {
  it('empties every store', async () => {
    const repos = createRepositories(freshDb());
    await repos.profile.save(makeProfile());
    await repos.cravings.add(makeCraving());
    await repos.achievements.addUnlocks([makeUnlock()]);
    await repos.reasons.add(makeReason());
    await repos.preferences.save(makePreferences());

    await repos.clearAll();

    expect(await repos.readSnapshot()).toEqual({
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });
  });
});
