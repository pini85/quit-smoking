import { afterEach, describe, expect, it } from 'vitest';
import { createDb, type QuitDb } from '@/lib/persistence/db';
import { createRepositories } from '@/lib/persistence/dexieRepositories';
import type { Repositories } from '@/lib/persistence/repositories';
import { exportData, previewImport, applyImport } from '@/lib/persistence/exportImport';
import { ImportError } from '@/domain/export/migrate';
import type {
  AchievementUnlock,
  BeliefAssessment,
  CravingSession,
  FreedomSession,
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

function makeAssessment(overrides: Partial<BeliefAssessment> = {}): BeliefAssessment {
  return {
    id: crypto.randomUUID(),
    beliefId: 'relaxation',
    assessedAt: '2026-01-03T09:00:00+02:00',
    strength: 3,
    context: 'brain',
    ...overrides,
  };
}

function makeFreedomSession(overrides: Partial<FreedomSession> = {}): FreedomSession {
  return {
    id: crypto.randomUUID(),
    startedAt: '2026-01-03T09:00:00+02:00',
    endedAt: '2026-01-03T09:04:30+02:00',
    kind: 'brain',
    ...overrides,
  };
}

/** A complete, valid v2 export file as raw JSON text. */
function v2FileJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 2,
    app: 'quit-smoking',
    exportedAt: '2026-01-05T12:00:00Z',
    profile: null,
    cravings: [],
    achievementUnlocks: [],
    reasons: [],
    preferences: null,
    beliefAssessments: [],
    freedomSessions: [],
    ...overrides,
  });
}

/** A pre-v2 export file, exactly as an older build of the app wrote it. */
function v1FileJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    app: 'quit-smoking',
    exportedAt: '2026-01-05T12:00:00Z',
    profile: null,
    cravings: [],
    achievementUnlocks: [],
    reasons: [],
    preferences: null,
    ...overrides,
  });
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
    beliefId: 'stress-relief',
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
  const assessment: BeliefAssessment = {
    id: crypto.randomUUID(),
    beliefId: 'relaxation',
    assessedAt: '2026-01-03T09:00:00+02:00',
    strength: 2,
    context: 'craving',
    trigger: 'coffee',
  };
  const freedom: FreedomSession = {
    id: crypto.randomUUID(),
    startedAt: '2026-01-03T09:00:00+02:00',
    endedAt: '2026-01-03T09:04:30+02:00',
    kind: 'exercise',
    beliefId: 'relaxation',
    trigger: 'coffee',
    lessonId: 'lesson-3',
  };
  await repos.profile.save(profile);
  await repos.cravings.add(craving);
  await repos.achievements.addUnlocks([unlock]);
  await repos.reasons.add(reason);
  await repos.preferences.save(prefs);
  await repos.beliefAssessments.add(assessment);
  await repos.freedomSessions.add(freedom);
  return { profile, craving, unlock, reason, prefs, assessment, freedom };
}

describe('exportData', () => {
  it('produces pretty-printed JSON with the correct file name', async () => {
    const repos = freshRepos();
    await seed(repos);

    const { json, fileName } = await exportData(repos, new Date('2026-01-05T12:00:00Z'));

    expect(fileName).toBe('quit-smoking-export-2026-01-05.json');
    expect(json).toContain('\n  '); // pretty-printed with 2-space indent
    const parsed = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(2);
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
      beliefAssessments: [],
      freedomSessions: [],
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
      beliefAssessments: [],
      freedomSessions: [],
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

describe('export -> clearAll -> import(replace): belief + freedom data survives', () => {
  it('round-trips both new collections through a full backup/restore cycle', async () => {
    const repos = freshRepos();
    const assessments = [
      makeAssessment({ beliefId: 'relaxation', strength: 4, context: 'brain' }),
      makeAssessment({
        beliefId: 'just-one',
        strength: 0,
        context: 'craving',
        trigger: 'coffee',
        assessedAt: '2026-01-04T09:00:00+02:00',
      }),
    ];
    const sessions = [
      makeFreedomSession({ kind: 'brain', beliefId: 'relaxation' }),
      makeFreedomSession({
        kind: 'exercise',
        lessonId: 'lesson-7',
        startedAt: '2026-01-04T09:00:00+02:00',
        endedAt: '2026-01-04T09:06:00+02:00',
      }),
    ];
    for (const a of assessments) await repos.beliefAssessments.add(a);
    for (const s of sessions) await repos.freedomSessions.add(s);

    const { json } = await exportData(repos, new Date('2026-01-05T12:00:00Z'));
    // The file itself must carry the rows — not just the DB.
    const parsed = JSON.parse(json);
    expect(parsed.beliefAssessments).toHaveLength(2);
    expect(parsed.freedomSessions).toHaveLength(2);

    await repos.clearAll();
    expect(await repos.beliefAssessments.getAll()).toEqual([]);
    expect(await repos.freedomSessions.getAll()).toEqual([]);

    const { file } = await previewImport(repos, json);
    await applyImport(repos, file, 'replace');

    const snapshot = await repos.readSnapshot();
    expect(snapshot.beliefAssessments).toEqual(assessments);
    expect(snapshot.freedomSessions).toEqual(sessions);
  });

  it('replace with a MIGRATED v1 file yields empty belief/freedom arrays (v1 knew neither)', async () => {
    const repos = freshRepos();
    await repos.beliefAssessments.add(makeAssessment());
    await repos.freedomSessions.add(makeFreedomSession());

    const { file } = await previewImport(repos, v1FileJson({ profile: makeProfile() }));
    await applyImport(repos, file, 'replace');

    const snapshot = await repos.readSnapshot();
    expect(snapshot.beliefAssessments).toEqual([]);
    expect(snapshot.freedomSessions).toEqual([]);
    expect(snapshot.profile).toEqual(makeProfile());
  });
});

describe('applyImport merge mode — belief + freedom collections', () => {
  it('unions imported belief assessments and freedom sessions into a populated DB, current winning on id collision', async () => {
    const repos = freshRepos();
    const deviceAssessment = makeAssessment({ id: 'shared-ba', strength: 0, context: 'craving' });
    const deviceOnlyAssessment = makeAssessment({ id: 'device-only-ba' });
    const deviceSession = makeFreedomSession({ id: 'shared-fs', lessonId: 'device-lesson' });
    const deviceOnlySession = makeFreedomSession({ id: 'device-only-fs' });
    await repos.beliefAssessments.add(deviceAssessment);
    await repos.beliefAssessments.add(deviceOnlyAssessment);
    await repos.freedomSessions.add(deviceSession);
    await repos.freedomSessions.add(deviceOnlySession);

    const fileJson = v2FileJson({
      beliefAssessments: [
        { ...deviceAssessment, strength: 4, context: 'brain' }, // same id, different content
        makeAssessment({ id: 'imported-only-ba', beliefId: 'identity', strength: 2 }),
      ],
      freedomSessions: [
        { ...deviceSession, lessonId: 'imported-lesson' },
        makeFreedomSession({ id: 'imported-only-fs', kind: 'exercise', lessonId: 'lesson-2' }),
      ],
    });

    const { file, summary } = await previewImport(repos, fileJson);
    expect(summary.newBeliefAssessments).toBe(1);
    expect(summary.newFreedomSessions).toBe(1);

    const applied = await applyImport(repos, file, 'merge');
    expect(applied.newBeliefAssessments).toBe(1);
    expect(applied.newFreedomSessions).toBe(1);

    const assessmentsAfter = await repos.beliefAssessments.getAll();
    expect(assessmentsAfter.map((a) => a.id).sort()).toEqual(
      ['device-only-ba', 'imported-only-ba', 'shared-ba'].sort()
    );
    // Device row survived — the imported one did NOT overwrite it.
    const shared = assessmentsAfter.find((a) => a.id === 'shared-ba');
    expect(shared?.strength).toBe(0);
    expect(shared?.context).toBe('craving');
    // And the imported-only row was really written, not silently dropped.
    expect(assessmentsAfter.find((a) => a.id === 'imported-only-ba')?.beliefId).toBe('identity');

    const sessionsAfter = await repos.freedomSessions.getAll();
    expect(sessionsAfter.map((s) => s.id).sort()).toEqual(
      ['device-only-fs', 'imported-only-fs', 'shared-fs'].sort()
    );
    expect(sessionsAfter.find((s) => s.id === 'shared-fs')?.lessonId).toBe('device-lesson');
    expect(sessionsAfter.find((s) => s.id === 'imported-only-fs')?.lessonId).toBe('lesson-2');
  });

  it('merging an old v1 file into a populated v2 DB never loses local belief data', async () => {
    const repos = freshRepos();
    const localAssessment = makeAssessment({ id: 'local-ba' });
    const localSession = makeFreedomSession({ id: 'local-fs' });
    await repos.beliefAssessments.add(localAssessment);
    await repos.freedomSessions.add(localSession);

    const { file, summary } = await previewImport(
      repos,
      v1FileJson({ cravings: [makeCraving({ id: 'from-old-backup' })] })
    );
    expect(summary.newBeliefAssessments).toBe(0);
    expect(summary.newFreedomSessions).toBe(0);

    await applyImport(repos, file, 'merge');

    expect(await repos.beliefAssessments.getAll()).toEqual([localAssessment]);
    expect(await repos.freedomSessions.getAll()).toEqual([localSession]);
    expect((await repos.cravings.getAll()).map((c) => c.id)).toEqual(['from-old-backup']);
  });

  it('preserves a craving beliefId across import', async () => {
    const repos = freshRepos();
    const craving = makeCraving({ id: 'tagged', beliefId: 'boredom-relief' });
    const { file } = await previewImport(repos, v2FileJson({ cravings: [craving] }));
    await applyImport(repos, file, 'merge');

    const all = await repos.cravings.getAll();
    expect(all[0].beliefId).toBe('boredom-relief');
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
      beliefAssessments: [],
      freedomSessions: [],
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
      beliefAssessments: [],
      freedomSessions: [],
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
      beliefAssessments: [],
      freedomSessions: [],
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
      schemaVersion: 2 as const,
      app: 'quit-smoking' as const,
      exportedAt: '2026-01-05T12:00:00Z',
      profile: makeProfile({ cigarettesPerDay: 1 }),
      cravings: [],
      achievementUnlocks: [],
      reasons: [poisonedReason],
      preferences: null,
      beliefAssessments: [],
      freedomSessions: [],
    };

    await expect(applyImport(repos, file, 'replace')).rejects.toBeTruthy();

    const snapshot = await repos.readSnapshot();
    expect(snapshot).toEqual({
      profile: seeded.profile,
      cravings: [seeded.craving],
      achievementUnlocks: [seeded.unlock],
      reasons: [seeded.reason],
      preferences: seeded.prefs,
      beliefAssessments: [],
      freedomSessions: [],
    });
  });
});
