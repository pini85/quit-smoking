import { describe, expect, it } from 'vitest';
import {
  ImportError,
  MIGRATIONS,
  detectVersion,
  migrateToLatest,
} from '@/domain/export/migrate';
import { CURRENT_EXPORT_VERSION } from '@/domain/export/format';
import { validateExportFile } from '@/lib/validation/importSchemas';

/**
 * A VERBATIM capture of a real export produced by the app while
 * CURRENT_EXPORT_VERSION was 1 — pasted here as a literal, never regenerated
 * from today's builders. This is THE backward-compatibility guarantee: if a
 * future schema change breaks this file, a real user's real backup breaks
 * with it. Do not "fix" this fixture to match new code; migrate the code.
 */
const CAPTURED_V1_EXPORT = `{
  "schemaVersion": 1,
  "app": "quit-smoking",
  "exportedAt": "2026-02-14T09:31:07.412Z",
  "profile": {
    "id": "singleton",
    "quitAt": "2026-01-06T07:15:00+02:00",
    "cigarettesPerDay": 18,
    "cigarettesPerPack": 20,
    "packPrice": 34.5,
    "currency": "ILS",
    "yearsSmoked": 14,
    "createdAt": "2026-01-06T07:16:22+02:00",
    "updatedAt": "2026-01-21T20:04:51+02:00"
  },
  "cravings": [
    {
      "id": "5f1c8a3e-2b47-4f9a-9c11-6d0a7e83b201",
      "startedAt": "2026-01-06T10:42:13+02:00",
      "initialIntensity": 8,
      "finalIntensity": 3,
      "trigger": "stress",
      "outcome": "passed",
      "endedAt": "2026-01-06T10:49:58+02:00",
      "interventionIds": ["breathing", "cold-water"],
      "roundCount": 2,
      "notes": "work call ran long"
    },
    {
      "id": "b28d4c60-9a1f-4d33-8e57-1c9f2a6b7d84",
      "startedAt": "2026-01-09T21:03:44+02:00",
      "initialIntensity": 6,
      "outcome": null
    },
    {
      "id": "e3a70b91-5c68-4a2d-b4f0-77d1e5c9a306",
      "startedAt": "2025-12-30T18:20:00+02:00",
      "initialIntensity": 9,
      "finalIntensity": 9,
      "trigger": "alcohol",
      "outcome": "smoked",
      "endedAt": "2025-12-30T18:24:11+02:00",
      "preQuit": true
    }
  ],
  "achievementUnlocks": [
    { "id": "first-day", "unlockedAt": "2026-01-07T07:15:00+02:00" },
    { "id": "first-week", "unlockedAt": "2026-01-13T07:15:00+02:00" }
  ],
  "reasons": [
    {
      "id": "a1b2c3d4-0000-4000-8000-000000000001",
      "text": "Run 5k with my daughter",
      "createdAt": "2026-01-06T07:18:03+02:00"
    },
    {
      "id": "a1b2c3d4-0000-4000-8000-000000000002",
      "text": "Stop hiding it from my mother",
      "createdAt": "2026-01-08T22:41:19+02:00",
      "archived": true
    }
  ],
  "preferences": {
    "id": "singleton",
    "theme": "dark",
    "moneyEquivalents": [{ "label": "coffee", "unitPrice": 12 }],
    "showEmergingEvidence": false,
    "dismissedInstallHint": true,
    "lastExportAt": "2026-02-01T11:02:44+02:00",
    "updatedAt": "2026-02-01T11:02:44+02:00"
  }
}`;

function validV1(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    app: 'quit-smoking',
    exportedAt: '2026-01-05T12:00:00Z',
    profile: null,
    cravings: [],
    achievementUnlocks: [],
    reasons: [],
    preferences: null,
    ...overrides,
  };
}

describe('detectVersion', () => {
  it('returns the schemaVersion of a well-formed file', () => {
    expect(detectVersion(validV1())).toBe(1);
  });

  it('throws ImportError when schemaVersion is missing', () => {
    const rest = validV1();
    delete rest.schemaVersion;
    expect(() => detectVersion(rest)).toThrow(ImportError);
  });

  it('throws ImportError when schemaVersion is not a number', () => {
    expect(() => detectVersion(validV1({ schemaVersion: '1' }))).toThrow(ImportError);
  });

  it('throws ImportError when app is not "quit-smoking"', () => {
    expect(() => detectVersion(validV1({ app: 'some-other-app' }))).toThrow(ImportError);
  });

  it('throws ImportError when app is missing', () => {
    const rest = validV1();
    delete rest.app;
    expect(() => detectVersion(rest)).toThrow(ImportError);
  });

  it('throws ImportError when raw is not an object', () => {
    expect(() => detectVersion('not an object')).toThrow(ImportError);
    expect(() => detectVersion(null)).toThrow(ImportError);
    expect(() => detectVersion(42)).toThrow(ImportError);
  });
});

function validV2(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...validV1(),
    schemaVersion: 2,
    beliefAssessments: [],
    freedomSessions: [],
    ...overrides,
  };
}

describe('migrateToLatest', () => {
  it('is the identity function for a file already at CURRENT_EXPORT_VERSION', () => {
    const file = validV2();
    expect(migrateToLatest(file)).toEqual(file);
  });

  it('throws ImportError when the file is from a newer app version', () => {
    const file = validV1({ schemaVersion: CURRENT_EXPORT_VERSION + 1 });
    expect(() => migrateToLatest(file)).toThrow(ImportError);
  });

  it('throws ImportError when a migration step is missing for an older version', () => {
    // Version 0 has no registered migration in the real MIGRATIONS map.
    const file = validV1({ schemaVersion: 0 });
    expect(() => migrateToLatest(file)).toThrow(ImportError);
  });

  it('walks the full migration chain by applying each registered step in order', () => {
    // Simulate a future v0 -> v1 migration to prove migrateToLatest actually
    // loops MIGRATIONS[v] -> MIGRATIONS[v+1] -> ... rather than special-casing.
    const fakeV0 = {
      schemaVersion: 0,
      app: 'quit-smoking',
      exportedAt: '2026-01-05T12:00:00Z',
      legacyProfile: null,
    };
    MIGRATIONS[0] = (file) => {
      const { legacyProfile, ...rest } = file;
      return { ...rest, schemaVersion: 1, profile: legacyProfile ?? null, cravings: [], achievementUnlocks: [], reasons: [], preferences: null };
    };
    try {
      const migrated = migrateToLatest(fakeV0);
      // Walked 0 -> 1 (the fake step) -> 2 (the real MIGRATIONS[1]).
      expect(migrated.schemaVersion).toBe(CURRENT_EXPORT_VERSION);
      expect(migrated.profile).toBeNull();
      expect(migrated.legacyProfile).toBeUndefined();
      expect(migrated.beliefAssessments).toEqual([]);
      expect(migrated.freedomSessions).toEqual([]);
    } finally {
      delete MIGRATIONS[0];
    }
  });

  it('throws ImportError for schemaVersion 3 (newer than this app knows)', () => {
    expect(() => migrateToLatest(validV2({ schemaVersion: 3 }))).toThrow(ImportError);
  });

  it('throws ImportError for an unknown/negative schemaVersion with no migration path', () => {
    expect(() => migrateToLatest(validV2({ schemaVersion: -1 }))).toThrow(ImportError);
  });
});

describe('migrateToLatest — v1 -> v2', () => {
  it('adds exactly the two new collections (empty) and bumps the version', () => {
    const v1 = validV1({ cravings: [{ id: 'c1' }], reasons: [{ id: 'r1' }] });
    const migrated = migrateToLatest(v1);

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.beliefAssessments).toEqual([]);
    expect(migrated.freedomSessions).toEqual([]);
    // Nothing else changed: same key set plus exactly the two new keys.
    expect(new Set(Object.keys(migrated))).toEqual(
      new Set([...Object.keys(v1), 'beliefAssessments', 'freedomSessions'])
    );
    expect(migrated.cravings).toEqual(v1.cravings);
    expect(migrated.reasons).toEqual(v1.reasons);
    expect(migrated.preferences).toBeNull();
  });

  it('does not mutate the input file', () => {
    const v1 = validV1();
    const clone = JSON.parse(JSON.stringify(v1));
    migrateToLatest(v1);
    expect(v1).toEqual(clone);
  });

  it('MIGRATIONS[1] is registered', () => {
    expect(typeof MIGRATIONS[1]).toBe('function');
  });
});

describe('captured v1 export file — backward-compatibility guarantee', () => {
  it('migrates to the current version and validates clean, gaining two empty collections', () => {
    const raw: unknown = JSON.parse(CAPTURED_V1_EXPORT);
    const migrated = migrateToLatest(raw);
    const file = validateExportFile(migrated);

    expect(file.schemaVersion).toBe(CURRENT_EXPORT_VERSION);
    expect(file.beliefAssessments).toEqual([]);
    expect(file.freedomSessions).toEqual([]);
  });

  it('preserves every collection and every optional field of the captured file', () => {
    const file = validateExportFile(migrateToLatest(JSON.parse(CAPTURED_V1_EXPORT)));

    expect(file.profile?.currency).toBe('ILS');
    expect(file.profile?.yearsSmoked).toBe(14);
    expect(file.profile?.quitAt).toBe('2026-01-06T07:15:00+02:00');
    expect(file.cravings).toHaveLength(3);
    expect(file.cravings[0].interventionIds).toEqual(['breathing', 'cold-water']);
    expect(file.cravings[0].roundCount).toBe(2);
    expect(file.cravings[0].notes).toBe('work call ran long');
    expect(file.cravings[1].outcome).toBeNull();
    expect(file.cravings[2].preQuit).toBe(true);
    expect(file.achievementUnlocks.map((u) => u.id)).toEqual(['first-day', 'first-week']);
    expect(file.reasons).toHaveLength(2);
    expect(file.reasons[1].archived).toBe(true);
    expect(file.preferences?.theme).toBe('dark');
    expect(file.preferences?.moneyEquivalents).toEqual([{ label: 'coffee', unitPrice: 12 }]);
    expect(file.preferences?.dismissedInstallHint).toBe(true);
    expect(file.preferences?.lastExportAt).toBe('2026-02-01T11:02:44+02:00');
    expect(file.preferences?.showEmergingEvidence).toBe(false);
  });
});
