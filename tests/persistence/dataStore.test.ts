import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDb, type QuitDb } from '@/lib/persistence/db';
import { createRepositories } from '@/lib/persistence/dexieRepositories';
import { DataStore } from '@/lib/services/dataStore';
import type { CravingSession, PersonalReason, QuitProfile } from '@/domain/types';

// Every test gets its own isolated fake-indexeddb database so state never
// leaks across tests. Track open DBs and close+delete them after each test.
const openDbs: QuitDb[] = [];

function freshDb(): QuitDb {
  const db = createDb(`test-datastore-${crypto.randomUUID()}`);
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

describe('DataStore', () => {
  it('starts in the loading state with empty collections', () => {
    const store = new DataStore(createRepositories(freshDb()));
    expect(store.getSnapshot()).toEqual({
      status: 'loading',
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });
  });

  it('load() populates the snapshot from the repositories and flips status to ready', async () => {
    const db = freshDb();
    const repos = createRepositories(db);
    const profile = makeProfile();
    await repos.profile.save(profile);
    const craving = makeCraving();
    await repos.cravings.add(craving);

    const store = new DataStore(repos);
    await store.load();

    expect(store.getSnapshot()).toEqual({
      status: 'ready',
      profile,
      cravings: [craving],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });
  });

  it('getSnapshot returns a stable reference until the next change', async () => {
    const store = new DataStore(createRepositories(freshDb()));
    const before = store.getSnapshot();
    expect(store.getSnapshot()).toBe(before);

    await store.load();
    const afterLoad = store.getSnapshot();
    expect(afterLoad).not.toBe(before);
    expect(store.getSnapshot()).toBe(afterLoad);
  });

  it('subscribe fires listeners on load() and on refresh()', async () => {
    const store = new DataStore(createRepositories(freshDb()));
    const listener = vi.fn();
    store.subscribe(listener);

    await store.load();
    expect(listener).toHaveBeenCalledTimes(1);

    await store.refresh();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe stops further callbacks', async () => {
    const store = new DataStore(createRepositories(freshDb()));
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    await store.load();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await store.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('saveProfile persists and notifies, and a fresh DataStore on the same db sees it', async () => {
    const db = freshDb();
    const repos = createRepositories(db);
    const store = new DataStore(repos);
    const listener = vi.fn();
    store.subscribe(listener);
    await store.load();
    listener.mockClear();

    const profile = makeProfile();
    await store.saveProfile(profile);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().profile).toEqual(profile);

    const secondStore = new DataStore(createRepositories(db));
    await secondStore.load();
    expect(secondStore.getSnapshot().profile).toEqual(profile);
  });

  it('savePreferences persists and notifies', async () => {
    const db = freshDb();
    const store = new DataStore(createRepositories(db));
    await store.load();

    const prefs = {
      id: 'singleton' as const,
      theme: 'dark' as const,
      showEmergingEvidence: true,
      updatedAt: '2026-01-01T08:00:00Z',
    };
    await store.savePreferences(prefs);
    expect(store.getSnapshot().preferences).toEqual(prefs);
  });

  it('addCraving and updateCraving persist and notify', async () => {
    const db = freshDb();
    const store = new DataStore(createRepositories(db));
    await store.load();

    const craving = makeCraving({ outcome: null });
    await store.addCraving(craving);
    expect(store.getSnapshot().cravings).toEqual([craving]);

    const resolved: CravingSession = { ...craving, outcome: 'passed', finalIntensity: 2 };
    await store.updateCraving(resolved);
    expect(store.getSnapshot().cravings).toEqual([resolved]);
  });

  it('addReason, updateReason and removeReason persist and notify', async () => {
    const db = freshDb();
    const store = new DataStore(createRepositories(db));
    await store.load();

    const reason = makeReason();
    await store.addReason(reason);
    expect(store.getSnapshot().reasons).toEqual([reason]);

    const updated = { ...reason, text: 'Updated' };
    await store.updateReason(updated);
    expect(store.getSnapshot().reasons).toEqual([updated]);

    await store.removeReason(reason.id);
    expect(store.getSnapshot().reasons).toEqual([]);
  });

  it('addUnlocks persists and notifies, idempotently', async () => {
    const db = freshDb();
    const store = new DataStore(createRepositories(db));
    await store.load();

    const unlock = { id: 'first-day', unlockedAt: '2026-01-02T08:00:00Z' };
    await store.addUnlocks([unlock]);
    expect(store.getSnapshot().achievementUnlocks).toEqual([unlock]);

    await store.addUnlocks([unlock]);
    expect(store.getSnapshot().achievementUnlocks).toEqual([unlock]);
  });

  it('a write-through call notifies exactly once', async () => {
    const db = freshDb();
    const store = new DataStore(createRepositories(db));
    await store.load();
    const listener = vi.fn();
    store.subscribe(listener);

    await store.addReason(makeReason());
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
