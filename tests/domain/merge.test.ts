import { describe, expect, it } from 'vitest';
import { mergeSnapshots } from '@/domain/export/merge';
import type { ExportSnapshot } from '@/domain/export/format';
import type { CravingSession, PersonalReason, AchievementUnlock, QuitProfile } from '@/domain/types';

function craving(overrides: Partial<CravingSession> = {}): CravingSession {
  return {
    id: 'c1',
    startedAt: '2026-01-01T08:00:00Z',
    initialIntensity: 5,
    outcome: null,
    ...overrides,
  };
}

function reason(overrides: Partial<PersonalReason> = {}): PersonalReason {
  return {
    id: 'r1',
    text: 'For my health',
    createdAt: '2026-01-01T08:00:00Z',
    ...overrides,
  };
}

function unlock(overrides: Partial<AchievementUnlock> = {}): AchievementUnlock {
  return { id: 'u1', unlockedAt: '2026-01-01T08:00:00Z', ...overrides };
}

function profile(overrides: Partial<QuitProfile> = {}): QuitProfile {
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

function emptySnapshot(overrides: Partial<ExportSnapshot> = {}): ExportSnapshot {
  return {
    profile: null,
    cravings: [],
    achievementUnlocks: [],
    reasons: [],
    preferences: null,
    ...overrides,
  };
}

describe('mergeSnapshots — union with id-collision keeping current', () => {
  it('unions cravings from both sides when ids differ', () => {
    const current = emptySnapshot({ cravings: [craving({ id: 'a' })] });
    const imported = emptySnapshot({ cravings: [craving({ id: 'b' })] });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.cravings.map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect(summary.newCravings).toBe(1);
    expect(summary.totalCravingsAfter).toBe(2);
  });

  it('on id collision, keeps the CURRENT craving, not the imported one', () => {
    const current = emptySnapshot({
      cravings: [craving({ id: 'shared', initialIntensity: 3, notes: 'current version' })],
    });
    const imported = emptySnapshot({
      cravings: [craving({ id: 'shared', initialIntensity: 9, notes: 'imported version' })],
    });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.cravings).toHaveLength(1);
    expect(merged.cravings[0].notes).toBe('current version');
    expect(summary.newCravings).toBe(0);
    expect(summary.totalCravingsAfter).toBe(1);
  });

  it('unions achievement unlocks by id, keeping current on collision', () => {
    const current = emptySnapshot({
      achievementUnlocks: [unlock({ id: 'shared', unlockedAt: '2026-01-01T08:00:00Z' })],
    });
    const imported = emptySnapshot({
      achievementUnlocks: [
        unlock({ id: 'shared', unlockedAt: '2099-01-01T08:00:00Z' }),
        unlock({ id: 'new-one' }),
      ],
    });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.achievementUnlocks).toHaveLength(2);
    const sharedUnlock = merged.achievementUnlocks.find((u) => u.id === 'shared');
    expect(sharedUnlock?.unlockedAt).toBe('2026-01-01T08:00:00Z');
    expect(summary.newUnlocks).toBe(1);
  });

  it('unions reasons by id, keeping current on collision', () => {
    const current = emptySnapshot({
      reasons: [reason({ id: 'shared', text: 'current text' })],
    });
    const imported = emptySnapshot({
      reasons: [reason({ id: 'shared', text: 'imported text' }), reason({ id: 'new-reason' })],
    });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.reasons).toHaveLength(2);
    const sharedReason = merged.reasons.find((r) => r.id === 'shared');
    expect(sharedReason?.text).toBe('current text');
    expect(summary.newReasons).toBe(1);
  });
});

describe('mergeSnapshots — profile/preferences adoption', () => {
  it('adopts the imported profile when current has none', () => {
    const current = emptySnapshot({ profile: null });
    const importedProfile = profile({ cigarettesPerDay: 15 });
    const imported = emptySnapshot({ profile: importedProfile });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.profile).toEqual(importedProfile);
    expect(summary.profileAdopted).toBe(true);
  });

  it('keeps the current profile when current already has one', () => {
    const currentProfile = profile({ cigarettesPerDay: 20 });
    const current = emptySnapshot({ profile: currentProfile });
    const imported = emptySnapshot({ profile: profile({ cigarettesPerDay: 5 }) });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.profile).toEqual(currentProfile);
    expect(summary.profileAdopted).toBe(false);
  });

  it('leaves profile null when neither side has one', () => {
    const { merged, summary } = mergeSnapshots(emptySnapshot(), emptySnapshot());
    expect(merged.profile).toBeNull();
    expect(summary.profileAdopted).toBe(false);
  });

  it('always keeps current preferences, even when current has none and imported does', () => {
    const current = emptySnapshot({ preferences: null });
    const imported = emptySnapshot({
      preferences: {
        id: 'singleton',
        theme: 'dark',
        showEmergingEvidence: true,
        updatedAt: '2026-01-01T08:00:00Z',
      },
    });

    const { merged } = mergeSnapshots(current, imported);
    expect(merged.preferences).toBeNull();
  });
});

describe('mergeSnapshots — sorting after merge', () => {
  it('sorts merged cravings by startedAt ascending', () => {
    const current = emptySnapshot({
      cravings: [craving({ id: 'late', startedAt: '2026-01-03T08:00:00Z' })],
    });
    const imported = emptySnapshot({
      cravings: [
        craving({ id: 'early', startedAt: '2026-01-01T08:00:00Z' }),
        craving({ id: 'mid', startedAt: '2026-01-02T08:00:00Z' }),
      ],
    });

    const { merged } = mergeSnapshots(current, imported);
    expect(merged.cravings.map((c) => c.id)).toEqual(['early', 'mid', 'late']);
  });

  it('sorts merged reasons by createdAt ascending', () => {
    const current = emptySnapshot({
      reasons: [reason({ id: 'late', createdAt: '2026-01-03T08:00:00Z' })],
    });
    const imported = emptySnapshot({
      reasons: [
        reason({ id: 'early', createdAt: '2026-01-01T08:00:00Z' }),
        reason({ id: 'mid', createdAt: '2026-01-02T08:00:00Z' }),
      ],
    });

    const { merged } = mergeSnapshots(current, imported);
    expect(merged.reasons.map((r) => r.id)).toEqual(['early', 'mid', 'late']);
  });
});

describe('mergeSnapshots — input immutability', () => {
  it('never mutates the current or imported snapshot objects or their arrays', () => {
    const current = emptySnapshot({
      cravings: [craving({ id: 'a' })],
      reasons: [reason({ id: 'r1' })],
      achievementUnlocks: [unlock({ id: 'u1' })],
      profile: null,
    });
    const imported = emptySnapshot({
      cravings: [craving({ id: 'b' })],
      reasons: [reason({ id: 'r2' })],
      achievementUnlocks: [unlock({ id: 'u2' })],
      profile: profile(),
    });

    const currentSnapshotClone = JSON.parse(JSON.stringify(current));
    const importedSnapshotClone = JSON.parse(JSON.stringify(imported));

    mergeSnapshots(current, imported);

    expect(current).toEqual(currentSnapshotClone);
    expect(imported).toEqual(importedSnapshotClone);
  });

  it('returns a merged snapshot that does not share array references with either input', () => {
    const current = emptySnapshot({ cravings: [craving({ id: 'a' })] });
    const imported = emptySnapshot({ cravings: [craving({ id: 'b' })] });

    const { merged } = mergeSnapshots(current, imported);
    merged.cravings.push(craving({ id: 'mutated' }));

    expect(current.cravings).toHaveLength(1);
    expect(imported.cravings).toHaveLength(1);
  });
});
