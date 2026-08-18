import Dexie, { type Table } from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { createDb } from '@/lib/persistence/db';
import type { CravingSession, QuitProfile } from '@/domain/types';

/**
 * Upgrade tests for the v1 -> v2 schema bump. These deliberately do NOT use
 * `QuitDb` to write the "old" data: a real upgrade starts from a database
 * that was created by the SHIPPED v1 schema, so v1 is declared inline below
 * and must stay a byte-for-byte copy of the `version(1).stores({...})` block
 * in `lib/persistence/db.ts` (which is frozen — v2 is added as a delta).
 * If someone ever edits that block in place, this test is the alarm.
 */
class V1Db extends Dexie {
  profile!: Table<QuitProfile, string>;
  cravings!: Table<CravingSession, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      profile: 'id',
      cravings: 'id, startedAt, trigger, outcome',
      achievementUnlocks: 'id',
      reasons: 'id, createdAt',
      preferences: 'id',
    });
  }
}

/**
 * A byte-for-byte copy of the shipped v1 + v2 `.stores({...})` blocks in
 * `lib/persistence/db.ts` (both frozen), used the same way `V1Db` is used
 * above: a real v2 -> v3 upgrade starts from a database that was created by
 * the SHIPPED v1+v2 schema, not from `QuitDb` itself.
 */
class V2Db extends Dexie {
  profile!: Table<QuitProfile, string>;
  cravings!: Table<CravingSession, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      profile: 'id',
      cravings: 'id, startedAt, trigger, outcome',
      achievementUnlocks: 'id',
      reasons: 'id, createdAt',
      preferences: 'id',
    });
    this.version(2).stores({
      beliefAssessments: 'id, assessedAt, beliefId',
      freedomSessions: 'id, startedAt',
    });
  }
}

// Both the v1 handle and the reopened v2 handle are tracked so each test
// cleans up after itself even if it fails partway.
const openDbs: Dexie[] = [];

function track<T extends Dexie>(db: T): T {
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

/**
 * Seeds a v1-schema database under `name` with the given rows, then CLOSES
 * it. Closing is mandatory: IndexedDB (and fake-indexeddb, faithfully) blocks
 * a version change while any other connection to the database is still open,
 * so a lingering v1 handle would hang the v2 upgrade instead of failing.
 */
async function seedV1(
  name: string,
  profile: QuitProfile,
  cravings: CravingSession[]
): Promise<void> {
  const v1 = track(new V1Db(name));
  await v1.open();
  await v1.profile.put(profile);
  await v1.cravings.bulkPut(cravings);
  v1.close();
  openDbs.pop(); // handed off: the reopened v2 handle owns deletion from here.
}

/**
 * Seeds a v1+v2-schema database under `name` with the given rows, then
 * CLOSES it — same rationale as `seedV1` above, one version later.
 */
async function seedV2(
  name: string,
  profile: QuitProfile,
  cravings: CravingSession[]
): Promise<void> {
  const v2 = track(new V2Db(name));
  await v2.open();
  await v2.profile.put(profile);
  await v2.cravings.bulkPut(cravings);
  v2.close();
  openDbs.pop(); // handed off: the reopened v3 handle owns deletion from here.
}

describe('QuitDb v1 -> v2 upgrade', () => {
  it('preserves existing rows and adds the two new stores, empty', async () => {
    const name = `test-migration-${crypto.randomUUID()}`;
    const profile = makeProfile();
    const cravingA = makeCraving({ startedAt: '2026-01-01T08:00:00Z', outcome: 'passed' });
    const cravingB = makeCraving({ startedAt: '2026-01-02T08:00:00Z', trigger: 'coffee' });
    await seedV1(name, profile, [cravingA, cravingB]);

    const db = track(createDb(name));
    await db.open();

    // `createDb` always carries every frozen delta forward, so a v1 database
    // opened today lands on the CURRENT version (3), not just v2.
    expect(db.verno).toBe(3);
    expect(await db.profile.get('singleton')).toEqual(profile);
    const cravings = await db.cravings.toArray();
    expect(cravings.map((c) => c.id).sort()).toEqual([cravingA.id, cravingB.id].sort());
    expect(await db.beliefAssessments.toArray()).toEqual([]);
    expect(await db.freedomSessions.toArray()).toEqual([]);
    expect(await db.sleepSessions.toArray()).toEqual([]);
  });

  it('accepts writes to the new stores on an upgraded database', async () => {
    const name = `test-migration-${crypto.randomUUID()}`;
    await seedV1(name, makeProfile(), [makeCraving()]);

    const db = track(createDb(name));
    const assessment = {
      id: crypto.randomUUID(),
      beliefId: 'relaxation' as const,
      assessedAt: '2026-03-01T08:00:00Z',
      strength: 3 as const,
      context: 'brain' as const,
    };
    const session = {
      id: crypto.randomUUID(),
      startedAt: '2026-03-01T08:00:00Z',
      endedAt: '2026-03-01T08:04:00Z',
      kind: 'brain' as const,
    };
    await db.beliefAssessments.add(assessment);
    await db.freedomSessions.add(session);

    expect(await db.beliefAssessments.toArray()).toEqual([assessment]);
    expect(await db.freedomSessions.toArray()).toEqual([session]);
  });

  it('round-trips a craving carrying the new non-indexed beliefId field', async () => {
    const name = `test-migration-${crypto.randomUUID()}`;
    await seedV1(name, makeProfile(), []);

    const db = track(createDb(name));
    // `beliefId` has no Dexie schema entry — whole rows are stored regardless
    // of which fields are indexed, so the cravings store needed no change.
    const tagged = makeCraving({ outcome: 'passed', finalIntensity: 2, beliefId: 'reward' });
    await db.cravings.add(tagged);

    expect(await db.cravings.get(tagged.id)).toEqual(tagged);
  });

  it('leaves rows written by v1 free of the new fields (no back-fill)', async () => {
    const name = `test-migration-${crypto.randomUUID()}`;
    const legacy = makeCraving();
    await seedV1(name, makeProfile(), [legacy]);

    const db = track(createDb(name));
    const row = await db.cravings.get(legacy.id);
    expect(row).toEqual(legacy);
    expect(row && 'beliefId' in row).toBe(false);
  });
});

describe('QuitDb v2 -> v3 upgrade', () => {
  it('preserves existing rows and adds the new sleepSessions store, empty', async () => {
    const name = `test-migration-${crypto.randomUUID()}`;
    const profile = makeProfile();
    const cravingA = makeCraving({ startedAt: '2026-01-01T08:00:00Z', outcome: 'passed' });
    const cravingB = makeCraving({ startedAt: '2026-01-02T08:00:00Z', trigger: 'coffee' });
    await seedV2(name, profile, [cravingA, cravingB]);

    const db = track(createDb(name));
    await db.open();

    expect(db.verno).toBe(3);
    expect(await db.profile.get('singleton')).toEqual(profile);
    const cravings = await db.cravings.toArray();
    expect(cravings.map((c) => c.id).sort()).toEqual([cravingA.id, cravingB.id].sort());
    expect(await db.beliefAssessments.toArray()).toEqual([]);
    expect(await db.freedomSessions.toArray()).toEqual([]);
    expect(await db.sleepSessions.toArray()).toEqual([]);
  });

  it('accepts writes to the new sleepSessions store on an upgraded database', async () => {
    const name = `test-migration-${crypto.randomUUID()}`;
    await seedV2(name, makeProfile(), [makeCraving()]);

    const db = track(createDb(name));
    const session = {
      id: crypto.randomUUID(),
      startedAt: '2026-03-01T22:00:00Z',
      state: 'recording' as const,
    };
    await db.sleepSessions.add(session);

    expect(await db.sleepSessions.toArray()).toEqual([session]);
  });

  it('full v1 -> v3 upgrade: preserves existing rows and adds every new store, empty', async () => {
    const name = `test-migration-${crypto.randomUUID()}`;
    const profile = makeProfile();
    const craving = makeCraving();
    await seedV1(name, profile, [craving]);

    const db = track(createDb(name));
    await db.open();

    expect(db.verno).toBe(3);
    expect(await db.profile.get('singleton')).toEqual(profile);
    expect((await db.cravings.toArray()).map((c) => c.id)).toEqual([craving.id]);
    expect(await db.beliefAssessments.toArray()).toEqual([]);
    expect(await db.freedomSessions.toArray()).toEqual([]);
    expect(await db.sleepSessions.toArray()).toEqual([]);
  });
});
