import { afterEach, describe, expect, it } from 'vitest';
import { createDb, type QuitDb } from '@/lib/persistence/db';
import { createRepositories } from '@/lib/persistence/dexieRepositories';
import type {
  AchievementUnlock,
  BeliefAssessment,
  CravingSession,
  FreedomSession,
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

function makeAssessment(overrides: Partial<BeliefAssessment> = {}): BeliefAssessment {
  return {
    id: crypto.randomUUID(),
    beliefId: 'relaxation',
    assessedAt: '2026-01-01T08:00:00Z',
    strength: 4,
    context: 'brain',
    ...overrides,
  };
}

function makeFreedomSession(overrides: Partial<FreedomSession> = {}): FreedomSession {
  return {
    id: crypto.randomUUID(),
    startedAt: '2026-01-01T08:00:00Z',
    endedAt: '2026-01-01T08:05:00Z',
    kind: 'brain',
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

  it('getAll sorts by actual instant, not raw string comparison, across mixed UTC offsets', async () => {
    const repos = createRepositories(freshDb());
    // These two share the same "clock digits" pattern that trips up naive
    // string sorting: "...T02:00:00-08:00" is 10:00 UTC (later), while
    // "...T10:00:00+09:00" is 01:00 UTC (earlier) — but as raw strings,
    // "02" < "10" so a string sort would (wrongly) put the later instant
    // first.
    const laterInstantEarlyLookingString = makeCraving({
      startedAt: '2026-01-01T02:00:00-08:00', // 2026-01-01T10:00:00Z
    });
    const earlierInstantLateLookingString = makeCraving({
      startedAt: '2026-01-01T10:00:00+09:00', // 2026-01-01T01:00:00Z
    });

    await repos.cravings.add(laterInstantEarlyLookingString);
    await repos.cravings.add(earlierInstantLateLookingString);

    const all = await repos.cravings.getAll();
    expect(all.map((c) => c.id)).toEqual([
      earlierInstantLateLookingString.id,
      laterInstantEarlyLookingString.id,
    ]);
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

  it('getAll sorts by actual instant, not raw string comparison, across mixed UTC offsets', async () => {
    const repos = createRepositories(freshDb());
    // Same counterexample as the cravings test: "02" < "10" as strings, but
    // -08:00 vs +09:00 flips which one is chronologically earlier.
    const laterInstantEarlyLookingString = makeReason({
      createdAt: '2026-01-01T02:00:00-08:00', // 2026-01-01T10:00:00Z
    });
    const earlierInstantLateLookingString = makeReason({
      createdAt: '2026-01-01T10:00:00+09:00', // 2026-01-01T01:00:00Z
    });

    await repos.reasons.bulkPut([
      laterInstantEarlyLookingString,
      earlierInstantLateLookingString,
    ]);

    const all = await repos.reasons.getAll();
    expect(all.map((r) => r.id)).toEqual([
      earlierInstantLateLookingString.id,
      laterInstantEarlyLookingString.id,
    ]);
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

describe('BeliefAssessmentRepository', () => {
  it('getAll returns an empty array when nothing has been assessed', async () => {
    const repos = createRepositories(freshDb());
    expect(await repos.beliefAssessments.getAll()).toEqual([]);
  });

  it('add stores an assessment, including its optional trigger', async () => {
    const repos = createRepositories(freshDb());
    const assessment = makeAssessment({ context: 'craving', trigger: 'coffee', strength: 2 });
    await repos.beliefAssessments.add(assessment);
    expect(await repos.beliefAssessments.getAll()).toEqual([assessment]);
  });

  it('keeps every assessment of the same belief — history is append-only, never overwritten', async () => {
    const repos = createRepositories(freshDb());
    const first = makeAssessment({ beliefId: 'reward', strength: 4 });
    const later = makeAssessment({
      beliefId: 'reward',
      strength: 1,
      assessedAt: '2026-02-01T08:00:00Z',
    });

    await repos.beliefAssessments.add(first);
    await repos.beliefAssessments.add(later);

    const all = await repos.beliefAssessments.getAll();
    expect(all.map((a) => a.id)).toEqual([first.id, later.id]);
  });

  it('getAll sorts by assessedAt ascending, regardless of insert order', async () => {
    const repos = createRepositories(freshDb());
    const late = makeAssessment({ assessedAt: '2026-01-03T08:00:00Z' });
    const early = makeAssessment({ assessedAt: '2026-01-01T08:00:00Z' });
    const mid = makeAssessment({ assessedAt: '2026-01-02T08:00:00Z' });

    await repos.beliefAssessments.add(late);
    await repos.beliefAssessments.add(early);
    await repos.beliefAssessments.add(mid);

    const all = await repos.beliefAssessments.getAll();
    expect(all.map((a) => a.id)).toEqual([early.id, mid.id, late.id]);
  });

  it('getAll sorts by actual instant, not raw string comparison, across mixed UTC offsets', async () => {
    const repos = createRepositories(freshDb());
    // Same counterexample as the cravings/reasons ordering tests: "02" < "10"
    // as strings, but -08:00 vs +09:00 flips which instant is earlier.
    const laterInstantEarlyLookingString = makeAssessment({
      assessedAt: '2026-01-01T02:00:00-08:00', // 2026-01-01T10:00:00Z
    });
    const earlierInstantLateLookingString = makeAssessment({
      assessedAt: '2026-01-01T10:00:00+09:00', // 2026-01-01T01:00:00Z
    });

    await repos.beliefAssessments.bulkPut([
      laterInstantEarlyLookingString,
      earlierInstantLateLookingString,
    ]);

    const all = await repos.beliefAssessments.getAll();
    expect(all.map((a) => a.id)).toEqual([
      earlierInstantLateLookingString.id,
      laterInstantEarlyLookingString.id,
    ]);
  });

  it('bulkPut upserts by id (re-putting the same id overwrites, does not duplicate)', async () => {
    const repos = createRepositories(freshDb());
    const assessment = makeAssessment({ strength: 4 });
    await repos.beliefAssessments.bulkPut([assessment]);
    await repos.beliefAssessments.bulkPut([{ ...assessment, strength: 0 }]);

    const all = await repos.beliefAssessments.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].strength).toBe(0);
  });
});

describe('FreedomSessionRepository', () => {
  it('getAll returns an empty array when no session has been recorded', async () => {
    const repos = createRepositories(freshDb());
    expect(await repos.freedomSessions.getAll()).toEqual([]);
  });

  it('add stores a session, including its optional lessonId/beliefId', async () => {
    const repos = createRepositories(freshDb());
    const session = makeFreedomSession({ kind: 'exercise', lessonId: 'why-quitting-is-easy' });
    await repos.freedomSessions.add(session);
    expect(await repos.freedomSessions.getAll()).toEqual([session]);
  });

  it('getAll sorts by startedAt ascending, regardless of insert order', async () => {
    const repos = createRepositories(freshDb());
    const late = makeFreedomSession({ startedAt: '2026-01-03T08:00:00Z' });
    const early = makeFreedomSession({ startedAt: '2026-01-01T08:00:00Z' });
    const mid = makeFreedomSession({ startedAt: '2026-01-02T08:00:00Z' });

    await repos.freedomSessions.add(late);
    await repos.freedomSessions.add(early);
    await repos.freedomSessions.add(mid);

    const all = await repos.freedomSessions.getAll();
    expect(all.map((s) => s.id)).toEqual([early.id, mid.id, late.id]);
  });

  it('getAll sorts by actual instant, not raw string comparison, across mixed UTC offsets', async () => {
    const repos = createRepositories(freshDb());
    const laterInstantEarlyLookingString = makeFreedomSession({
      startedAt: '2026-01-01T02:00:00-08:00', // 2026-01-01T10:00:00Z
    });
    const earlierInstantLateLookingString = makeFreedomSession({
      startedAt: '2026-01-01T10:00:00+09:00', // 2026-01-01T01:00:00Z
    });

    await repos.freedomSessions.bulkPut([
      laterInstantEarlyLookingString,
      earlierInstantLateLookingString,
    ]);

    const all = await repos.freedomSessions.getAll();
    expect(all.map((s) => s.id)).toEqual([
      earlierInstantLateLookingString.id,
      laterInstantEarlyLookingString.id,
    ]);
  });

  it('bulkPut upserts by id', async () => {
    const repos = createRepositories(freshDb());
    const session = makeFreedomSession({ kind: 'brain' });
    await repos.freedomSessions.bulkPut([session]);
    await repos.freedomSessions.bulkPut([{ ...session, kind: 'exercise' }]);

    const all = await repos.freedomSessions.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].kind).toBe('exercise');
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
      beliefAssessments: [],
      freedomSessions: [],
    });
  });

  it('returns a single consistent read across every store', async () => {
    const repos = createRepositories(freshDb());
    const profile = makeProfile();
    const craving = makeCraving();
    const unlock = makeUnlock();
    const reason = makeReason();
    const prefs = makePreferences();
    const assessment = makeAssessment();
    const freedomSession = makeFreedomSession();

    await repos.profile.save(profile);
    await repos.cravings.add(craving);
    await repos.achievements.addUnlocks([unlock]);
    await repos.reasons.add(reason);
    await repos.preferences.save(prefs);
    await repos.beliefAssessments.add(assessment);
    await repos.freedomSessions.add(freedomSession);

    const snapshot = await repos.readSnapshot();
    expect(snapshot).toEqual({
      profile,
      cravings: [craving],
      achievementUnlocks: [unlock],
      reasons: [reason],
      preferences: prefs,
      beliefAssessments: [assessment],
      freedomSessions: [freedomSession],
    });
  });

  it('sorts cravings, reasons, assessments and freedom sessions by actual instant across mixed UTC offsets', async () => {
    const repos = createRepositories(freshDb());
    // Same counterexample as the repository-level ordering tests: "02" <
    // "10" as strings, but -08:00 vs +09:00 flips which instant is earlier.
    const laterCraving = makeCraving({ startedAt: '2026-01-01T02:00:00-08:00' }); // 10:00Z
    const earlierCraving = makeCraving({ startedAt: '2026-01-01T10:00:00+09:00' }); // 01:00Z
    const laterReason = makeReason({ createdAt: '2026-01-01T02:00:00-08:00' }); // 10:00Z
    const earlierReason = makeReason({ createdAt: '2026-01-01T10:00:00+09:00' }); // 01:00Z
    const laterAssessment = makeAssessment({ assessedAt: '2026-01-01T02:00:00-08:00' }); // 10:00Z
    const earlierAssessment = makeAssessment({ assessedAt: '2026-01-01T10:00:00+09:00' }); // 01:00Z
    const laterFreedom = makeFreedomSession({ startedAt: '2026-01-01T02:00:00-08:00' }); // 10:00Z
    const earlierFreedom = makeFreedomSession({ startedAt: '2026-01-01T10:00:00+09:00' }); // 01:00Z

    await repos.cravings.bulkPut([laterCraving, earlierCraving]);
    await repos.reasons.bulkPut([laterReason, earlierReason]);
    await repos.beliefAssessments.bulkPut([laterAssessment, earlierAssessment]);
    await repos.freedomSessions.bulkPut([laterFreedom, earlierFreedom]);

    const snapshot = await repos.readSnapshot();
    expect(snapshot.cravings.map((c) => c.id)).toEqual([earlierCraving.id, laterCraving.id]);
    expect(snapshot.reasons.map((r) => r.id)).toEqual([earlierReason.id, laterReason.id]);
    expect(snapshot.beliefAssessments.map((a) => a.id)).toEqual([
      earlierAssessment.id,
      laterAssessment.id,
    ]);
    expect(snapshot.freedomSessions.map((s) => s.id)).toEqual([
      earlierFreedom.id,
      laterFreedom.id,
    ]);
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
    await repos.beliefAssessments.add(makeAssessment({ beliefId: 'deprivation' }));
    await repos.freedomSessions.add(makeFreedomSession());

    const newProfile = makeProfile({ cigarettesPerDay: 5 });
    const newCraving = makeCraving();
    const newUnlock = makeUnlock({ id: 'fresh' });
    const newReason = makeReason({ text: 'Fresh reason' });
    const newPrefs = makePreferences({ theme: 'light' });
    const newAssessment = makeAssessment({ beliefId: 'just-one', strength: 1 });
    const newFreedomSession = makeFreedomSession({ kind: 'exercise', lessonId: 'the-trap' });

    await repos.replaceAll({
      profile: newProfile,
      cravings: [newCraving],
      achievementUnlocks: [newUnlock],
      reasons: [newReason],
      preferences: newPrefs,
      beliefAssessments: [newAssessment],
      freedomSessions: [newFreedomSession],
    });

    const snapshot = await repos.readSnapshot();
    expect(snapshot).toEqual({
      profile: newProfile,
      cravings: [newCraving],
      achievementUnlocks: [newUnlock],
      reasons: [newReason],
      preferences: newPrefs,
      beliefAssessments: [newAssessment],
      freedomSessions: [newFreedomSession],
    });
  });

  it('replacing with an empty snapshot clears every store', async () => {
    const repos = createRepositories(freshDb());
    await repos.profile.save(makeProfile());
    await repos.cravings.add(makeCraving());
    await repos.achievements.addUnlocks([makeUnlock()]);
    await repos.reasons.add(makeReason());
    await repos.preferences.save(makePreferences());
    await repos.beliefAssessments.add(makeAssessment());
    await repos.freedomSessions.add(makeFreedomSession());

    await repos.replaceAll({
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
      beliefAssessments: [],
      freedomSessions: [],
    });

    expect(await repos.readSnapshot()).toEqual({
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
      beliefAssessments: [],
      freedomSessions: [],
    });
  });

  it('aborts the whole transaction on a mid-write failure, leaving prior data intact', async () => {
    const repos = createRepositories(freshDb());
    const originalProfile = makeProfile();
    const originalCraving = makeCraving();
    const originalUnlock = makeUnlock();
    const originalReason = makeReason();
    const originalPrefs = makePreferences();
    const originalAssessment = makeAssessment();
    const originalFreedomSession = makeFreedomSession();

    await repos.profile.save(originalProfile);
    await repos.cravings.add(originalCraving);
    await repos.achievements.addUnlocks([originalUnlock]);
    await repos.reasons.add(originalReason);
    await repos.preferences.save(originalPrefs);
    await repos.beliefAssessments.add(originalAssessment);
    await repos.freedomSessions.add(originalFreedomSession);

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
        beliefAssessments: [],
        freedomSessions: [],
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
      beliefAssessments: [originalAssessment],
      freedomSessions: [originalFreedomSession],
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
    await repos.beliefAssessments.add(makeAssessment());
    await repos.freedomSessions.add(makeFreedomSession());

    await repos.clearAll();

    expect(await repos.readSnapshot()).toEqual({
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
      beliefAssessments: [],
      freedomSessions: [],
    });
  });
});
