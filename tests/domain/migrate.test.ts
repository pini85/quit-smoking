import { describe, expect, it } from 'vitest';
import {
  ImportError,
  MIGRATIONS,
  detectVersion,
  migrateToLatest,
} from '@/domain/export/migrate';
import { CURRENT_EXPORT_VERSION } from '@/domain/export/format';

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

describe('migrateToLatest', () => {
  it('is the identity function for a file already at CURRENT_EXPORT_VERSION', () => {
    const file = validV1();
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
      expect(migrated.schemaVersion).toBe(1);
      expect(migrated.profile).toBeNull();
      expect(migrated.legacyProfile).toBeUndefined();
    } finally {
      delete MIGRATIONS[0];
    }
  });
});
