import { describe, expect, it } from 'vitest';
import type { AchievementCondition, CravingSession, QuitProfile } from '@/domain/types';
import { ACHIEVEMENT_DEFINITIONS } from '@/domain/achievements/definitions';
import {
  conditionMet,
  evaluateAchievements,
  progressToward,
  type AchievementContext,
} from '@/domain/achievements/engine';

let idCounter = 0;
function mkSession(overrides: Partial<CravingSession> = {}): CravingSession {
  idCounter += 1;
  return {
    id: `session-${idCounter}`,
    startedAt: '2026-01-01T12:00:00Z',
    initialIntensity: 5,
    outcome: 'passed',
    ...overrides,
  };
}

function mkProfile(overrides: Partial<QuitProfile> = {}): QuitProfile {
  return {
    id: 'singleton',
    quitAt: '2026-01-01T00:00:00Z',
    cigarettesPerDay: 20,
    cigarettesPerPack: 20,
    packPrice: 10,
    currency: 'EUR',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mkCtx(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    profile: mkProfile(),
    cravings: [],
    unlocked: new Set(),
    now: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('conditionMet — smoke-free-hours', () => {
  const cond: AchievementCondition = { type: 'smoke-free-hours', hours: 24 };

  it('false just below the boundary', () => {
    const ctx = mkCtx({ now: new Date('2026-01-01T23:59:59.999Z') });
    expect(conditionMet(cond, ctx)).toBe(false);
  });

  it('true exactly at the boundary', () => {
    const ctx = mkCtx({ now: new Date('2026-01-02T00:00:00.000Z') });
    expect(conditionMet(cond, ctx)).toBe(true);
  });

  it('is anchored to quitAt and unaffected by a smoked slip session (no revocation)', () => {
    const ctx = mkCtx({
      now: new Date('2026-01-06T00:00:00Z'), // 5 days elapsed
      cravings: [
        mkSession({ outcome: 'smoked', startedAt: '2026-01-03T00:00:00Z', endedAt: '2026-01-03T00:05:00Z' }),
      ],
    });
    expect(conditionMet(cond, ctx)).toBe(true);
  });
});

describe('conditionMet — cigarettes-avoided', () => {
  const cond: AchievementCondition = { type: 'cigarettes-avoided', count: 10 };

  it('false just below the boundary (11h at 20/day -> 9 avoided)', () => {
    const ctx = mkCtx({ now: new Date('2026-01-01T11:00:00Z') });
    expect(conditionMet(cond, ctx)).toBe(false);
  });

  it('true exactly at the boundary (12h at 20/day -> 10 avoided)', () => {
    const ctx = mkCtx({ now: new Date('2026-01-01T12:00:00Z') });
    expect(conditionMet(cond, ctx)).toBe(true);
  });
});

describe('conditionMet — money-saved', () => {
  const cond: AchievementCondition = { type: 'money-saved', amount: 10 };

  it('false just below the boundary', () => {
    // (20/20)*10*days < 10 => days < 1 => just under 24h
    const ctx = mkCtx({ now: new Date('2026-01-01T23:00:00Z') });
    expect(conditionMet(cond, ctx)).toBe(false);
  });

  it('true exactly at the boundary (24h -> 10 saved)', () => {
    const ctx = mkCtx({ now: new Date('2026-01-02T00:00:00Z') });
    expect(conditionMet(cond, ctx)).toBe(true);
  });
});

describe('conditionMet — cravings-passed', () => {
  const cond: AchievementCondition = { type: 'cravings-passed', count: 2 };

  it('false when only 1 passed', () => {
    const ctx = mkCtx({ cravings: [mkSession({ outcome: 'passed' })] });
    expect(conditionMet(cond, ctx)).toBe(false);
  });

  it('true exactly at the boundary, INCLUDING preQuit passes', () => {
    const ctx = mkCtx({
      cravings: [
        mkSession({ outcome: 'passed', preQuit: true }),
        mkSession({ outcome: 'much-weaker' }),
      ],
    });
    expect(conditionMet(cond, ctx)).toBe(true);
  });

  it('unresolved and smoked sessions do not count as passed', () => {
    const ctx = mkCtx({
      cravings: [
        mkSession({ outcome: 'unresolved' }),
        mkSession({ outcome: 'smoked' }),
        mkSession({ outcome: 'passed' }),
      ],
    });
    expect(conditionMet(cond, ctx)).toBe(false);
  });
});

describe('conditionMet — trigger-passed', () => {
  const cond: AchievementCondition = { type: 'trigger-passed', trigger: 'coffee', count: 2 };

  it('false just below the boundary', () => {
    const ctx = mkCtx({
      cravings: [mkSession({ trigger: 'coffee', outcome: 'passed' })],
    });
    expect(conditionMet(cond, ctx)).toBe(false);
  });

  it('true exactly at the boundary', () => {
    const ctx = mkCtx({
      cravings: [
        mkSession({ trigger: 'coffee', outcome: 'passed' }),
        mkSession({ trigger: 'coffee', outcome: 'much-weaker' }),
      ],
    });
    expect(conditionMet(cond, ctx)).toBe(true);
  });

  it('other triggers do not contribute', () => {
    const ctx = mkCtx({
      cravings: [
        mkSession({ trigger: 'coffee', outcome: 'passed' }),
        mkSession({ trigger: 'stress', outcome: 'passed' }),
      ],
    });
    expect(conditionMet(cond, ctx)).toBe(false);
  });
});

describe('conditionMet — craving-free-hours', () => {
  const cond: AchievementCondition = { type: 'craving-free-hours', hours: 24 };

  it('requires at least one session — false with zero sessions regardless of elapsed time', () => {
    const ctx = mkCtx({ cravings: [], now: new Date('2026-06-01T00:00:00Z') });
    expect(conditionMet(cond, ctx)).toBe(false);
  });

  it('false just below the boundary (last session -> now gap)', () => {
    const ctx = mkCtx({
      cravings: [mkSession({ startedAt: '2026-01-01T00:00:00Z' })],
      now: new Date('2026-01-01T23:59:59.999Z'),
    });
    expect(conditionMet(cond, ctx)).toBe(false);
  });

  it('true exactly at the boundary (last session -> now gap)', () => {
    const ctx = mkCtx({
      cravings: [mkSession({ startedAt: '2026-01-01T00:00:00Z' })],
      now: new Date('2026-01-02T00:00:00.000Z'),
    });
    expect(conditionMet(cond, ctx)).toBe(true);
  });

  it('uses the longest gap BETWEEN sessions, not just the last-session-to-now gap', () => {
    const ctx = mkCtx({
      cravings: [
        mkSession({ startedAt: '2026-01-01T00:00:00Z' }),
        mkSession({ startedAt: '2026-01-02T01:00:00Z' }), // 25h gap from previous
        mkSession({ startedAt: '2026-01-02T02:00:00Z' }), // 1h gap from previous
      ],
      now: new Date('2026-01-02T03:00:00Z'), // only 1h since last session
    });
    expect(conditionMet(cond, ctx)).toBe(true);
  });

  it('does not use quitAt as a sentinel (a session logged well after quitAt with no prior gap does not qualify from quitAt)', () => {
    const ctx = mkCtx({
      profile: mkProfile({ quitAt: '2025-01-01T00:00:00Z' }), // ~1 year before the session
      cravings: [mkSession({ startedAt: '2026-01-01T00:00:00Z' })],
      now: new Date('2026-01-01T01:00:00Z'), // only 1h since the (only) session
    });
    expect(conditionMet(cond, ctx)).toBe(false);
  });
});

describe('conditionMet — smoke-free-weekend', () => {
  const cond: AchievementCondition = { type: 'smoke-free-weekend', count: 1 };

  it('false just before Monday 06:00 local', () => {
    const ctx = mkCtx({
      profile: mkProfile({ quitAt: new Date(2026, 0, 1, 0, 0, 0).toISOString() }), // Thu Jan 1
      now: new Date(2026, 0, 5, 5, 59, 59, 999), // Mon Jan 5, just before 06:00
    });
    expect(conditionMet(cond, ctx)).toBe(false);
  });

  it('true exactly at Monday 06:00 local (Fri 18:00 Jan 2 -> Mon 06:00 Jan 5)', () => {
    const ctx = mkCtx({
      profile: mkProfile({ quitAt: new Date(2026, 0, 1, 0, 0, 0).toISOString() }), // Thu Jan 1
      now: new Date(2026, 0, 5, 6, 0, 0, 0), // Mon Jan 5, 06:00 exactly
    });
    expect(conditionMet(cond, ctx)).toBe(true);
  });

  it('a streak starting on a Saturday skips that weekend — the first qualifying one is the NEXT Fri-Mon', () => {
    // Streak starts Sat Jan 3 2026 00:00 (a smoked session ends there) — Fri Jan 2
    // 18:00 already started before the streak, so it cannot be "fully inside"
    // [streakStart, now]. The next candidate is Fri Jan 9 18:00 -> Mon Jan 12 06:00.
    const ctx = mkCtx({
      profile: mkProfile({ quitAt: new Date(2026, 0, 1, 0, 0, 0).toISOString() }), // Thu Jan 1
      cravings: [
        mkSession({
          outcome: 'smoked',
          startedAt: new Date(2026, 0, 3, 0, 0, 0).toISOString(),
          endedAt: new Date(2026, 0, 3, 0, 5, 0).toISOString(),
        }),
      ],
      now: new Date(2026, 0, 5, 6, 0, 0, 0), // would have qualified for the skipped weekend
    });
    expect(conditionMet(cond, ctx)).toBe(false);
  });

  it('...and becomes true once the NEXT weekend (Fri Jan 9 18:00 -> Mon Jan 12 06:00) fully elapses', () => {
    const ctx = mkCtx({
      profile: mkProfile({ quitAt: new Date(2026, 0, 1, 0, 0, 0).toISOString() }),
      cravings: [
        mkSession({
          outcome: 'smoked',
          startedAt: new Date(2026, 0, 3, 0, 0, 0).toISOString(),
          endedAt: new Date(2026, 0, 3, 0, 5, 0).toISOString(),
        }),
      ],
      now: new Date(2026, 0, 12, 6, 0, 0, 0), // Mon Jan 12, 06:00 exactly
    });
    expect(conditionMet(cond, ctx)).toBe(true);
  });

  it('just before that next weekend fully elapses is still false', () => {
    const ctx = mkCtx({
      profile: mkProfile({ quitAt: new Date(2026, 0, 1, 0, 0, 0).toISOString() }),
      cravings: [
        mkSession({
          outcome: 'smoked',
          startedAt: new Date(2026, 0, 3, 0, 0, 0).toISOString(),
          endedAt: new Date(2026, 0, 3, 0, 5, 0).toISOString(),
        }),
      ],
      now: new Date(2026, 0, 12, 5, 59, 59, 999),
    });
    expect(conditionMet(cond, ctx)).toBe(false);
  });
});

describe('evaluateAchievements', () => {
  const defs = ACHIEVEMENT_DEFINITIONS;

  it('returns definitions whose condition is met and are not already unlocked', () => {
    const ctx = mkCtx({ now: new Date('2026-01-02T00:00:00Z') }); // exactly 24h
    const result = evaluateAchievements(defs, ctx);
    expect(result.map((d) => d.id)).toContain('first-day');
  });

  it('excludes ids already present in ctx.unlocked', () => {
    const ctx = mkCtx({ now: new Date('2026-01-02T00:00:00Z'), unlocked: new Set(['first-day']) });
    const result = evaluateAchievements(defs, ctx);
    expect(result.map((d) => d.id)).not.toContain('first-day');
  });

  it('is idempotent: folding the previous result into unlocked yields [] on the next pass', () => {
    const ctx1 = mkCtx({ now: new Date('2026-01-02T00:00:00Z') });
    const first = evaluateAchievements(defs, ctx1);
    expect(first.length).toBeGreaterThan(0);

    const unlockedIds = new Set(first.map((d) => d.id));
    const ctx2 = mkCtx({ now: ctx1.now, unlocked: unlockedIds });
    const second = evaluateAchievements(defs, ctx2);
    expect(second).toEqual([]);
  });

  it('never mutates defs or ctx.unlocked', () => {
    const unlocked = new Set<string>();
    const ctx = mkCtx({ now: new Date('2026-01-02T00:00:00Z'), unlocked });
    const snapshotDefs = JSON.parse(JSON.stringify(defs));
    evaluateAchievements(defs, ctx);
    expect(defs).toEqual(snapshotDefs);
    expect(unlocked.size).toBe(0);
  });

  it('a slip (smoked session) does not revoke an already-unlocked time-based achievement', () => {
    const ctx = mkCtx({
      now: new Date('2026-01-06T00:00:00Z'),
      unlocked: new Set(['first-day', 'three-days']),
      cravings: [
        mkSession({ outcome: 'smoked', startedAt: '2026-01-04T00:00:00Z', endedAt: '2026-01-04T00:05:00Z' }),
      ],
    });
    // Already unlocked ones stay excluded from the result (they are not
    // "revoked" back into an unlocked state, nor re-surfaced as newly met).
    const result = evaluateAchievements(defs, ctx);
    expect(result.map((d) => d.id)).not.toContain('first-day');
    expect(result.map((d) => d.id)).not.toContain('three-days');
    // And the underlying condition is still independently true (not revoked).
    expect(conditionMet({ type: 'smoke-free-hours', hours: 24 }, ctx)).toBe(true);
    expect(conditionMet({ type: 'smoke-free-hours', hours: 72 }, ctx)).toBe(true);
  });
});

describe('progressToward', () => {
  it('smoke-free-hours: clamps current to the target once elapsed exceeds it', () => {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'first-day')!;
    const ctx = mkCtx({ now: new Date('2026-01-10T00:00:00Z') }); // 9 days elapsed >> 24h target
    expect(progressToward(def, ctx)).toEqual({ current: 24, target: 24 });
  });

  it('smoke-free-hours: reports partial elapsed hours below target', () => {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'first-day')!;
    const ctx = mkCtx({ now: new Date('2026-01-01T12:00:00Z') }); // 12h elapsed
    expect(progressToward(def, ctx)).toEqual({ current: 12, target: 24 });
  });

  it('smoke-free-hours: never negative when now precedes quitAt', () => {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'first-day')!;
    const ctx = mkCtx({ now: new Date('2025-12-31T00:00:00Z') });
    expect(progressToward(def, ctx)).toEqual({ current: 0, target: 24 });
  });

  it('cigarettes-avoided: current is the avoided count, target is the condition count', () => {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'avoided-10')!;
    const ctx = mkCtx({ now: new Date('2026-01-01T12:00:00Z') }); // 10 avoided at 20/day, 12h
    expect(progressToward(def, ctx)).toEqual({ current: 10, target: 10 });
  });

  it('money-saved: current is floor(saved)', () => {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'saved-50')!;
    // (20/20)*10*days = 10*days; days=0.99 -> 9.9 -> floor 9
    const ctx = mkCtx({ now: new Date('2026-01-01T23:45:36Z') }); // ~0.99 day
    expect(progressToward(def, ctx).target).toBe(50);
    expect(Number.isInteger(progressToward(def, ctx).current)).toBe(true);
  });

  it('cravings-passed: current is the passed count', () => {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'craving-10')!;
    const ctx = mkCtx({ cravings: [mkSession({ outcome: 'passed' }), mkSession({ outcome: 'smoked' })] });
    expect(progressToward(def, ctx)).toEqual({ current: 1, target: 10 });
  });

  it('trigger-passed: current is the passed count for that trigger only', () => {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'coffee-10')!;
    const ctx = mkCtx({
      cravings: [
        mkSession({ trigger: 'coffee', outcome: 'passed' }),
        mkSession({ trigger: 'stress', outcome: 'passed' }),
      ],
    });
    expect(progressToward(def, ctx)).toEqual({ current: 1, target: 10 });
  });

  it('craving-free-hours: clamps current to the target', () => {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'quiet-24h')!;
    const ctx = mkCtx({
      cravings: [mkSession({ startedAt: '2026-01-01T00:00:00Z' })],
      now: new Date('2026-01-20T00:00:00Z'), // huge gap, way past 24h target
    });
    expect(progressToward(def, ctx)).toEqual({ current: 24, target: 24 });
  });

  it('craving-free-hours: current is 0 with no sessions logged', () => {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'quiet-24h')!;
    const ctx = mkCtx({ cravings: [] });
    expect(progressToward(def, ctx)).toEqual({ current: 0, target: 24 });
  });

  it('smoke-free-weekend: 0 when not yet achieved, 1 once achieved', () => {
    const def = ACHIEVEMENT_DEFINITIONS.find((d) => d.id === 'smoke-free-weekend')!;
    const notYet = mkCtx({
      profile: mkProfile({ quitAt: new Date(2026, 0, 1, 0, 0, 0).toISOString() }),
      now: new Date(2026, 0, 3, 0, 0, 0),
    });
    expect(progressToward(def, notYet)).toEqual({ current: 0, target: 1 });

    const achieved = mkCtx({
      profile: mkProfile({ quitAt: new Date(2026, 0, 1, 0, 0, 0).toISOString() }),
      now: new Date(2026, 0, 5, 6, 0, 0, 0),
    });
    expect(progressToward(def, achieved)).toEqual({ current: 1, target: 1 });
  });
});

describe('ACHIEVEMENT_DEFINITIONS integrity', () => {
  it('has exactly 30 entries', () => {
    expect(ACHIEVEMENT_DEFINITIONS).toHaveLength(30);
  });

  it('has unique ids', () => {
    const ids = ACHIEVEMENT_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every fact is a nonempty, concrete string (not just whitespace)', () => {
    for (const d of ACHIEVEMENT_DEFINITIONS) {
      expect(d.fact.trim().length).toBeGreaterThan(0);
    }
  });

  it('every tier is 1, 2, or 3', () => {
    for (const d of ACHIEVEMENT_DEFINITIONS) {
      expect([1, 2, 3]).toContain(d.tier);
    }
  });

  it('every title is nonempty', () => {
    for (const d of ACHIEVEMENT_DEFINITIONS) {
      expect(d.title.trim().length).toBeGreaterThan(0);
    }
  });
});
