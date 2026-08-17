import { afterEach, describe, expect, it } from 'vitest';
import { createDb, type QuitDb } from '@/lib/persistence/db';
import { createRepositories } from '@/lib/persistence/dexieRepositories';
import type { Repositories } from '@/lib/persistence/repositories';
import { exportData, previewImport, applyImport } from '@/lib/persistence/exportImport';
import { ImportError } from '@/domain/export/migrate';
import type {
  AchievementUnlock,
  CravingSession,
  PersonalReason,
  Preferences,
  QuitProfile,
} from '@/domain/types';

const openDbs: QuitDb[] = [];

function freshRepos(): Repositories {
  const db = createDb(`test-${crypto.randomUUID()}`);
  openDbs.push(db);
  return createRepositories(db);
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
  return { id: 'first-day', unlockedAt: '2026-01-02T08:00:00Z', ...overrides };
}

async function seed(repos: Repositories) {
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
  return { profile, craving, unlock, reason, prefs };
}

/**
 * Seeds one row of each kind with EVERY optional field populated, using
 * object-literal key order that matches the domain type declarations (and
 * therefore the validation schema's shape order) field-for-field. This
 * matters because zod/mini's parsed output orders keys by the schema's
 * declared shape, not by the input's key order — so a byte-equality check
 * across a validate-then-reserialize round trip is only meaningful if the
 * pre-import object's key order already matches that canonical order.
 */
async function seedFullyPopulated(repos: Repositories) {
  const profile: QuitProfile = {
    id: 'singleton',
    quitAt: '2026-01-01T08:00:00Z',
    cigarettesPerDay: 20,
    cigarettesPerPack: 20,
    packPrice: 10,
    currency: 'EUR',
    yearsSmoked: 15,
    createdAt: '2026-01-01T08:00:00Z',
    updatedAt: '2026-01-01T08:00:00Z',
  };
  const craving: CravingSession = {
    id: crypto.randomUUID(),
    startedAt: '2026-01-01T08:00:00Z',
    initialIntensity: 7,
    finalIntensity: 2,
    trigger: 'stress',
    outcome: 'passed',
    endedAt: '2026-01-01T08:10:00Z',
    interventionIds: ['breathing', 'walk'],
    roundCount: 2,
    preQuit: false,
    notes: 'handled it',
  };
  const unlock = makeUnlock();
  const reason: PersonalReason = {
    id: crypto.randomUUID(),
    text: 'For my health',
    createdAt: '2026-01-01T08:00:00Z',
    archived: true,
  };
  const prefs: Preferences = {
    id: 'singleton',
    theme: 'dark',
    moneyEquivalents: [{ label: 'coffee', unitPrice: 3.5 }],
    showEmergingEvidence: true,
    dismissedInstallHint: true,
    lastExportAt: '2026-01-04T08:00:00Z',
    updatedAt: '2026-01-04T08:00:00Z',
  };
  await repos.profile.save(profile);
  await repos.cravings.add(craving);
  await repos.achievements.addUnlocks([unlock]);
  await repos.reasons.add(reason);
  await repos.preferences.save(prefs);
  return { profile, craving, unlock, reason, prefs };
}

describe('exportData', () => {
  it('produces pretty-printed JSON with the correct file name', async () => {
    const repos = freshRepos();
    await seed(repos);

    const { json, fileName } = await exportData(repos, new Date('2026-01-05T12:00:00Z'));

    expect(fileName).toBe('quit-smoking-export-2026-01-05.json');
    expect(json).toContain('\n  '); // pretty-printed with 2-space indent
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.app).toBe('quit-smoking');
    expect(parsed.exportedAt).toBe('2026-01-05T12:00:00.000Z');
  });

  it('exports an empty database as an empty-but-valid file', async () => {
    const repos = freshRepos();
    const { json } = await exportData(repos, new Date('2026-01-05T12:00:00Z'));
    const parsed = JSON.parse(json);
    expect(parsed.profile).toBeNull();
    expect(parsed.cravings).toEqual([]);
  });
});

describe('export -> erase -> import(replace) roundtrip', () => {
  it('restores every field exactly (byte-equal snapshot)', async () => {
    const repos = freshRepos();
    const seeded = await seed(repos);

    const { json } = await exportData(repos, new Date('2026-01-05T12:00:00Z'));
    await repos.clearAll();
    expect(await repos.readSnapshot()).toEqual({
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });

    const { file } = await previewImport(repos, json);
    await applyImport(repos, file, 'replace');

    const snapshot = await repos.readSnapshot();
    expect(snapshot).toEqual({
      profile: seeded.profile,
      cravings: [seeded.craving],
      achievementUnlocks: [seeded.unlock],
      reasons: [seeded.reason],
      preferences: seeded.prefs,
    });
  });

  it('re-export after a replace-import is byte-identical JSON to the original export, for a fully-populated snapshot', async () => {
    const repos = freshRepos();
    await seedFullyPopulated(repos);

    const before = await exportData(repos, new Date('2026-01-05T12:00:00Z'));
    await repos.clearAll();

    const { file } = await previewImport(repos, before.json);
    await applyImport(repos, file, 'replace');

    const after = await exportData(repos, new Date('2026-01-05T12:00:00Z'));

    // True string equality, not just deep-equal parsed objects: this catches
    // a field silently becoming `undefined` (and therefore omitted by
    // JSON.stringify) somewhere in the validate-then-reserialize path, which
    // toEqual on parsed objects would not distinguish from "field absent".
    expect(after.json).toBe(before.json);
  });
});

describe('applyImport merge mode', () => {
  it('keeps existing device rows on id collision and adds genuinely new rows', async () => {
    const repos = freshRepos();
    const sharedId = 'shared-craving';
    const currentCraving = makeCraving({ id: sharedId, notes: 'device version' });
    const deviceOnlyCraving = makeCraving({ id: 'device-only' });
    await repos.cravings.add(currentCraving);
    await repos.cravings.add(deviceOnlyCraving);

    const importedCraving = makeCraving({ id: sharedId, notes: 'imported version' });
    const importedOnlyCraving = makeCraving({ id: 'imported-only' });
    const fileJson = JSON.stringify({
      schemaVersion: 1,
      app: 'quit-smoking',
      exportedAt: '2026-01-05T12:00:00Z',
      profile: null,
      cravings: [importedCraving, importedOnlyCraving],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });

    const { file, summary } = await previewImport(repos, fileJson);
    expect(summary.newCravings).toBe(1); // only 'imported-only' is new

    const resultSummary = await applyImport(repos, file, 'merge');
    expect(resultSummary.newCravings).toBe(1);

    const all = await repos.cravings.getAll();
    expect(all.map((c) => c.id).sort()).toEqual(
      ['device-only', 'imported-only', sharedId].sort()
    );
    const sharedAfter = all.find((c) => c.id === sharedId);
    expect(sharedAfter?.notes).toBe('device version');
  });

  it('adopts imported profile only when device has none', async () => {
    const repos = freshRepos();
    // Device has no profile.
    const importedProfile = makeProfile({ cigarettesPerDay: 12 });
    const fileJson = JSON.stringify({
      schemaVersion: 1,
      app: 'quit-smoking',
      exportedAt: '2026-01-05T12:00:00Z',
      profile: importedProfile,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });

    const { file, summary } = await previewImport(repos, fileJson);
    expect(summary.profileAdopted).toBe(true);

    await applyImport(repos, file, 'merge');
    expect(await repos.profile.get()).toEqual(importedProfile);
  });
});

describe('previewImport rejects corruption without touching the DB', () => {
  it('throws ImportError on syntactically invalid JSON, DB untouched', async () => {
    const repos = freshRepos();
    const seeded = await seed(repos);

    await expect(previewImport(repos, '{ this is not json')).rejects.toThrow(ImportError);

    expect(await repos.readSnapshot()).toEqual({
      profile: seeded.profile,
      cravings: [seeded.craving],
      achievementUnlocks: [seeded.unlock],
      reasons: [seeded.reason],
      preferences: seeded.prefs,
    });
  });

  it('throws ImportError on a structurally invalid (corrupt) file, DB untouched', async () => {
    const repos = freshRepos();
    const seeded = await seed(repos);

    const corrupt = JSON.stringify({
      schemaVersion: 1,
      app: 'quit-smoking',
      exportedAt: '2026-01-05T12:00:00Z',
      profile: { ...makeProfile(), cigarettesPerDay: 99999 }, // out of range
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });

    await expect(previewImport(repos, corrupt)).rejects.toThrow(ImportError);

    expect(await repos.readSnapshot()).toEqual({
      profile: seeded.profile,
      cravings: [seeded.craving],
      achievementUnlocks: [seeded.unlock],
      reasons: [seeded.reason],
      preferences: seeded.prefs,
    });
  });

  it('throws ImportError on a file from a different app, DB untouched', async () => {
    const repos = freshRepos();
    const seeded = await seed(repos);

    const wrongApp = JSON.stringify({
      schemaVersion: 1,
      app: 'some-other-app',
      exportedAt: '2026-01-05T12:00:00Z',
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    });

    await expect(previewImport(repos, wrongApp)).rejects.toThrow(ImportError);
    expect(await repos.readSnapshot()).toEqual({
      profile: seeded.profile,
      cravings: [seeded.craving],
      achievementUnlocks: [seeded.unlock],
      reasons: [seeded.reason],
      preferences: seeded.prefs,
    });
  });
});

describe('applyImport replace atomicity', () => {
  it('leaves prior data completely intact if the write fails partway through', async () => {
    const repos = freshRepos();
    const seeded = await seed(repos);

    // A non-structured-cloneable value forces IndexedDB to reject mid-write,
    // which must abort the WHOLE transaction (including prior clears).
    const poisonedReason = {
      ...makeReason(),
      poison: () => {},
    } as unknown as PersonalReason;

    const file = {
      schemaVersion: 1 as const,
      app: 'quit-smoking' as const,
      exportedAt: '2026-01-05T12:00:00Z',
      profile: makeProfile({ cigarettesPerDay: 1 }),
      cravings: [],
      achievementUnlocks: [],
      reasons: [poisonedReason],
      preferences: null,
    };

    await expect(applyImport(repos, file, 'replace')).rejects.toBeTruthy();

    const snapshot = await repos.readSnapshot();
    expect(snapshot).toEqual({
      profile: seeded.profile,
      cravings: [seeded.craving],
      achievementUnlocks: [seeded.unlock],
      reasons: [seeded.reason],
      preferences: seeded.prefs,
    });
  });
});
