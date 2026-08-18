import { describe, expect, it } from 'vitest';
import { mergeSnapshots } from '@/domain/export/merge';
import type { ExportSnapshot } from '@/domain/export/format';
import type {
  CravingSession,
  PersonalReason,
  AchievementUnlock,
  QuitProfile,
  BeliefAssessment,
  FreedomSession,
  SleepSession,
} from '@/domain/types';

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

function assessment(overrides: Partial<BeliefAssessment> = {}): BeliefAssessment {
  return {
    id: 'ba1',
    beliefId: 'relaxation',
    assessedAt: '2026-01-01T08:00:00Z',
    strength: 3,
    context: 'brain',
    ...overrides,
  };
}

function freedomSession(overrides: Partial<FreedomSession> = {}): FreedomSession {
  return {
    id: 'fs1',
    startedAt: '2026-01-01T08:00:00Z',
    endedAt: '2026-01-01T08:05:00Z',
    kind: 'brain',
    ...overrides,
  };
}

function sleepSession(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    id: 'ss1',
    startedAt: '2026-01-01T22:00:00Z',
    state: 'recorded',
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
    beliefAssessments: [],
    freedomSessions: [],
    sleepSessions: [],
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

  it('collapses duplicate ids WITHIN the imported array itself: first copy kept, second dropped and not counted as new', () => {
    const current = emptySnapshot();
    const imported = emptySnapshot({
      cravings: [
        craving({ id: 'dup', notes: 'first copy' }),
        craving({ id: 'dup', notes: 'second copy' }),
      ],
    });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.cravings).toHaveLength(1);
    expect(merged.cravings[0].notes).toBe('first copy');
    expect(summary.newCravings).toBe(1);
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

describe('mergeSnapshots — belief assessments and freedom sessions', () => {
  it('unions belief assessments from both sides when ids differ', () => {
    const current = emptySnapshot({ beliefAssessments: [assessment({ id: 'a' })] });
    const imported = emptySnapshot({ beliefAssessments: [assessment({ id: 'b' })] });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.beliefAssessments.map((a) => a.id).sort()).toEqual(['a', 'b']);
    expect(summary.newBeliefAssessments).toBe(1);
  });

  it('on id collision, keeps the CURRENT belief assessment', () => {
    const current = emptySnapshot({
      beliefAssessments: [assessment({ id: 'shared', strength: 0 })],
    });
    const imported = emptySnapshot({
      beliefAssessments: [assessment({ id: 'shared', strength: 4 }), assessment({ id: 'new' })],
    });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.beliefAssessments).toHaveLength(2);
    expect(merged.beliefAssessments.find((a) => a.id === 'shared')?.strength).toBe(0);
    expect(summary.newBeliefAssessments).toBe(1);
  });

  it('unions freedom sessions from both sides when ids differ', () => {
    const current = emptySnapshot({ freedomSessions: [freedomSession({ id: 'a' })] });
    const imported = emptySnapshot({ freedomSessions: [freedomSession({ id: 'b' })] });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.freedomSessions.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(summary.newFreedomSessions).toBe(1);
  });

  it('on id collision, keeps the CURRENT freedom session', () => {
    const current = emptySnapshot({
      freedomSessions: [freedomSession({ id: 'shared', lessonId: 'device' })],
    });
    const imported = emptySnapshot({
      freedomSessions: [
        freedomSession({ id: 'shared', lessonId: 'imported' }),
        freedomSession({ id: 'new' }),
      ],
    });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.freedomSessions).toHaveLength(2);
    expect(merged.freedomSessions.find((s) => s.id === 'shared')?.lessonId).toBe('device');
    expect(summary.newFreedomSessions).toBe(1);
  });

  it('counts zero new rows when both sides are empty', () => {
    const { summary } = mergeSnapshots(emptySnapshot(), emptySnapshot());
    expect(summary.newBeliefAssessments).toBe(0);
    expect(summary.newFreedomSessions).toBe(0);
    expect(summary.newSleepSessions).toBe(0);
  });

  it('sorts merged belief assessments by assessedAt ascending', () => {
    const current = emptySnapshot({
      beliefAssessments: [assessment({ id: 'late', assessedAt: '2026-01-03T08:00:00Z' })],
    });
    const imported = emptySnapshot({
      beliefAssessments: [
        assessment({ id: 'early', assessedAt: '2026-01-01T08:00:00Z' }),
        assessment({ id: 'mid', assessedAt: '2026-01-02T08:00:00Z' }),
      ],
    });

    const { merged } = mergeSnapshots(current, imported);
    expect(merged.beliefAssessments.map((a) => a.id)).toEqual(['early', 'mid', 'late']);
  });

  it('sorts merged freedom sessions by startedAt ascending, comparing instants across offsets', () => {
    const current = emptySnapshot({
      // 2026-01-01T09:00:00+02:00 is 07:00Z — EARLIER than 08:00Z despite the
      // larger wall-clock hour. Sorting by string would get this backwards.
      freedomSessions: [
        freedomSession({
          id: 'earlier-instant',
          startedAt: '2026-01-01T09:00:00+02:00',
          endedAt: '2026-01-01T09:05:00+02:00',
        }),
      ],
    });
    const imported = emptySnapshot({
      freedomSessions: [freedomSession({ id: 'later-instant', startedAt: '2026-01-01T08:00:00Z' })],
    });

    const { merged } = mergeSnapshots(current, imported);
    expect(merged.freedomSessions.map((s) => s.id)).toEqual(['earlier-instant', 'later-instant']);
  });

  it('never mutates either side’s new collections', () => {
    const current = emptySnapshot({
      beliefAssessments: [assessment({ id: 'a' })],
      freedomSessions: [freedomSession({ id: 'a' })],
    });
    const imported = emptySnapshot({
      beliefAssessments: [assessment({ id: 'b' })],
      freedomSessions: [freedomSession({ id: 'b' })],
    });
    const currentClone = JSON.parse(JSON.stringify(current));
    const importedClone = JSON.parse(JSON.stringify(imported));

    const { merged } = mergeSnapshots(current, imported);
    merged.beliefAssessments.push(assessment({ id: 'mutated' }));
    merged.freedomSessions.push(freedomSession({ id: 'mutated' }));

    expect(current).toEqual(currentClone);
    expect(imported).toEqual(importedClone);
  });
});

describe('mergeSnapshots — sleep sessions', () => {
  it('unions sleep sessions from both sides when ids differ', () => {
    const current = emptySnapshot({ sleepSessions: [sleepSession({ id: 'a' })] });
    const imported = emptySnapshot({ sleepSessions: [sleepSession({ id: 'b' })] });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.sleepSessions.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(summary.newSleepSessions).toBe(1);
  });

  it('on id collision, keeps the CURRENT sleep session', () => {
    const current = emptySnapshot({
      sleepSessions: [sleepSession({ id: 'shared', state: 'analyzed' })],
    });
    const imported = emptySnapshot({
      sleepSessions: [
        sleepSession({ id: 'shared', state: 'recorded' }),
        sleepSession({ id: 'new' }),
      ],
    });

    const { merged, summary } = mergeSnapshots(current, imported);

    expect(merged.sleepSessions).toHaveLength(2);
    expect(merged.sleepSessions.find((s) => s.id === 'shared')?.state).toBe('analyzed');
    expect(summary.newSleepSessions).toBe(1);
  });

  it('sorts merged sleep sessions by startedAt ascending, comparing instants across offsets', () => {
    const current = emptySnapshot({
      // 2026-01-01T09:00:00+02:00 is 07:00Z — EARLIER than 08:00Z despite the
      // larger wall-clock hour.
      sleepSessions: [sleepSession({ id: 'earlier-instant', startedAt: '2026-01-01T09:00:00+02:00' })],
    });
    const imported = emptySnapshot({
      sleepSessions: [sleepSession({ id: 'later-instant', startedAt: '2026-01-01T08:00:00Z' })],
    });

    const { merged } = mergeSnapshots(current, imported);
    expect(merged.sleepSessions.map((s) => s.id)).toEqual(['earlier-instant', 'later-instant']);
  });

  it('never mutates either side’s sleepSessions collection', () => {
    const current = emptySnapshot({ sleepSessions: [sleepSession({ id: 'a' })] });
    const imported = emptySnapshot({ sleepSessions: [sleepSession({ id: 'b' })] });
    const currentClone = JSON.parse(JSON.stringify(current));
    const importedClone = JSON.parse(JSON.stringify(imported));

    const { merged } = mergeSnapshots(current, imported);
    merged.sleepSessions.push(sleepSession({ id: 'mutated' }));

    expect(current).toEqual(currentClone);
    expect(imported).toEqual(importedClone);
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
