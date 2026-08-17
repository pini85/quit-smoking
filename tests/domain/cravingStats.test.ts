import { describe, expect, it } from 'vitest';
import type { CravingSession, Trigger } from '@/domain/types';
import { isoWeekKey, startOfLocalWeek } from '@/domain/time';
import {
  resolvedSessions,
  cravingCounts,
  avgInitialIntensity,
  avgFinalIntensity,
  avgIntensityDrop,
  avgDurationSec,
  strongestTrigger,
  hourHistogram,
  hardestWindow,
  weeklyCounts,
  longestCravingFreeGapMs,
  perTriggerStats,
  alreadyProved,
  weekStats,
  firstWeekVsThisWeek,
} from '@/domain/stats/cravingStats';

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

describe('resolvedSessions', () => {
  it('excludes null and unresolved outcomes, keeps everything else', () => {
    const open = mkSession({ outcome: null });
    const unresolved = mkSession({ outcome: 'unresolved' });
    const passed = mkSession({ outcome: 'passed' });
    const smoked = mkSession({ outcome: 'smoked' });
    expect(resolvedSessions([open, unresolved, passed, smoked])).toEqual([passed, smoked]);
  });

  it('returns [] for empty input', () => {
    expect(resolvedSessions([])).toEqual([]);
  });
});

describe('cravingCounts', () => {
  it('returns all-zero/null shape for empty input (no NaN)', () => {
    expect(cravingCounts([])).toEqual({
      total: 0,
      resolved: 0,
      passedWithoutSmoking: 0,
      smoked: 0,
      passRate: null,
    });
  });

  it('counts total including unresolved and open sessions, but excludes them from passRate', () => {
    const sessions = [
      mkSession({ outcome: null }), // open
      mkSession({ outcome: 'unresolved' }),
      mkSession({ outcome: 'passed' }),
      mkSession({ outcome: 'much-weaker' }),
      mkSession({ outcome: 'smoked' }),
    ];
    const result = cravingCounts(sessions);
    expect(result.total).toBe(5);
    expect(result.resolved).toBe(3); // passed, much-weaker, smoked
    expect(result.smoked).toBe(1);
    expect(result.passedWithoutSmoking).toBe(2);
    expect(result.passRate).toBeCloseTo(2 / 3, 10);
  });

  it('passRate is null (not NaN) when there are sessions but none resolved', () => {
    const sessions = [mkSession({ outcome: null }), mkSession({ outcome: 'unresolved' })];
    const result = cravingCounts(sessions);
    expect(result.passRate).toBeNull();
    expect(Number.isNaN(result.passRate as unknown as number)).toBe(false);
  });
});

describe('avgInitialIntensity', () => {
  it('returns null for empty input', () => {
    expect(avgInitialIntensity([])).toBeNull();
  });

  it('averages all sessions with a value, rounded to 1 decimal', () => {
    const sessions = [
      mkSession({ initialIntensity: 3 }),
      mkSession({ initialIntensity: 4 }),
      mkSession({ initialIntensity: 4 }),
    ];
    expect(avgInitialIntensity(sessions)).toBeCloseTo(3.7, 5);
  });
});

describe('avgFinalIntensity', () => {
  it('returns null for empty input', () => {
    expect(avgFinalIntensity([])).toBeNull();
  });

  it('returns null when no session has a finalIntensity', () => {
    expect(avgFinalIntensity([mkSession({ finalIntensity: undefined })])).toBeNull();
  });

  it('averages only sessions that have a finalIntensity', () => {
    const sessions = [
      mkSession({ finalIntensity: 2 }),
      mkSession({ finalIntensity: 4 }),
      mkSession({ finalIntensity: undefined }),
    ];
    expect(avgFinalIntensity(sessions)).toBe(3);
  });
});

describe('avgIntensityDrop', () => {
  it('returns null for empty input', () => {
    expect(avgIntensityDrop([])).toBeNull();
  });

  it('averages initial-final only for sessions having both values', () => {
    const sessions = [
      mkSession({ initialIntensity: 8, finalIntensity: 2 }), // drop 6
      mkSession({ initialIntensity: 6, finalIntensity: 4 }), // drop 2
      mkSession({ initialIntensity: 9, finalIntensity: undefined }), // excluded
    ];
    expect(avgIntensityDrop(sessions)).toBe(4);
  });
});

describe('avgDurationSec', () => {
  it('returns null for empty input', () => {
    expect(avgDurationSec([])).toBeNull();
  });

  it('returns null when no resolved session has an endedAt', () => {
    const sessions = [mkSession({ outcome: 'passed', endedAt: undefined })];
    expect(avgDurationSec(sessions)).toBeNull();
  });

  it('excludes unresolved and open sessions even if they have endedAt', () => {
    const sessions = [
      mkSession({ outcome: 'unresolved', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:05:00Z' }),
      mkSession({ outcome: null, startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:05:00Z' }),
    ];
    expect(avgDurationSec(sessions)).toBeNull();
  });

  it('averages duration in seconds for resolved sessions with endedAt', () => {
    const sessions = [
      mkSession({ outcome: 'passed', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:01:00Z' }), // 60s
      mkSession({ outcome: 'smoked', startedAt: '2026-01-01T00:00:00Z', endedAt: '2026-01-01T00:02:00Z' }), // 120s
    ];
    expect(avgDurationSec(sessions)).toBe(90);
  });
});

describe('strongestTrigger', () => {
  it('returns null when no session has a recorded trigger', () => {
    expect(strongestTrigger([mkSession({ trigger: undefined })])).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(strongestTrigger([])).toBeNull();
  });

  it('returns the mode trigger by raw count', () => {
    const sessions = [
      mkSession({ trigger: 'stress' }),
      mkSession({ trigger: 'stress' }),
      mkSession({ trigger: 'coffee' }),
    ];
    expect(strongestTrigger(sessions)).toEqual({ trigger: 'stress', count: 2 });
  });

  it('breaks a count tie by higher count of passed (resolved, non-smoked) sessions', () => {
    const sessions = [
      mkSession({ trigger: 'coffee', outcome: 'passed' }),
      mkSession({ trigger: 'coffee', outcome: 'passed' }),
      mkSession({ trigger: 'coffee', outcome: 'smoked' }),
      mkSession({ trigger: 'stress', outcome: 'passed' }),
      mkSession({ trigger: 'stress', outcome: 'smoked' }),
      mkSession({ trigger: 'stress', outcome: 'smoked' }),
    ];
    // both have count 3; coffee has 2 passed vs stress's 1 passed
    expect(strongestTrigger(sessions)).toEqual({ trigger: 'coffee', count: 3 });
  });

  it('breaks a full tie (count and passed count) alphabetically', () => {
    const sessions = [
      mkSession({ trigger: 'boredom', outcome: 'passed' }),
      mkSession({ trigger: 'boredom', outcome: 'smoked' }),
      mkSession({ trigger: 'alcohol', outcome: 'passed' }),
      mkSession({ trigger: 'alcohol', outcome: 'smoked' }),
    ];
    expect(strongestTrigger(sessions)).toEqual({ trigger: 'alcohol', count: 2 });
  });
});

describe('hourHistogram', () => {
  it('returns a length-24 zero array for empty input', () => {
    expect(hourHistogram([])).toEqual(new Array(24).fill(0));
  });

  it('honors the embedded offset rather than device timezone', () => {
    const sessions = [
      mkSession({ startedAt: '2026-01-01T21:30:00+03:00' }), // literal hour 21
      mkSession({ startedAt: '2026-01-01T05:00:00-05:00' }), // literal hour 5
    ];
    const hist = hourHistogram(sessions);
    expect(hist[21]).toBe(1);
    expect(hist[5]).toBe(1);
    expect(hist.reduce((a, b) => a + b, 0)).toBe(2);
  });
});

describe('hardestWindow', () => {
  it('returns null for empty input', () => {
    expect(hardestWindow([])).toBeNull();
  });

  it('finds the densest contiguous 3h window, wrapping midnight', () => {
    const sessions = [
      mkSession({ startedAt: '2026-01-01T23:00:00Z' }),
      mkSession({ startedAt: '2026-01-01T23:10:00Z' }),
      mkSession({ startedAt: '2026-01-01T23:20:00Z' }),
      mkSession({ startedAt: '2026-01-02T00:00:00Z' }),
      mkSession({ startedAt: '2026-01-02T00:10:00Z' }),
      mkSession({ startedAt: '2026-01-02T00:20:00Z' }),
      mkSession({ startedAt: '2026-01-02T01:00:00Z' }),
      mkSession({ startedAt: '2026-01-02T01:10:00Z' }),
      mkSession({ startedAt: '2026-01-02T01:20:00Z' }),
      // a decoy, non-adjacent
      mkSession({ startedAt: '2026-01-02T10:00:00Z' }),
      mkSession({ startedAt: '2026-01-02T10:10:00Z' }),
    ];
    expect(hardestWindow(sessions)).toEqual({ startHour: 23, endHour: 2, count: 9 });
  });
});

describe('weeklyCounts', () => {
  it('zero-fills every ISO week from quitAt through now inclusive', () => {
    const quitAt = new Date(2026, 0, 1, 9, 0, 0);
    const now = new Date(quitAt.getTime() + 21 * 86_400_000); // exactly 3 weeks later
    const sessions = [
      mkSession({ startedAt: quitAt.toISOString() }),
      mkSession({ startedAt: now.toISOString() }),
    ];
    const result = weeklyCounts(sessions, quitAt, now);
    // quitAt's week, two quiet weeks in between, then now's week: 4 weeks inclusive.
    expect(result).toHaveLength(4);
    expect(result[0].weekKey).toBe(isoWeekKey(startOfLocalWeek(quitAt)));
    expect(result[3].weekKey).toBe(isoWeekKey(startOfLocalWeek(now)));
    expect(result[0].count).toBe(1);
    expect(result[1].count).toBe(0); // quiet middle weeks, zero-filled
    expect(result[2].count).toBe(0);
    expect(result[3].count).toBe(1);
  });

  it('returns a single zero-count week when there are no sessions and quitAt === now', () => {
    const at = new Date(2026, 0, 5, 0, 0, 0);
    const result = weeklyCounts([], at, at);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(0);
  });
});

describe('longestCravingFreeGapMs', () => {
  it('returns the full quitAt-to-now span when there are no sessions', () => {
    const quitAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-05T00:00:00Z');
    expect(longestCravingFreeGapMs([], quitAt, now)).toBe(4 * 86_400_000);
  });

  it('finds the max gap between consecutive events including quitAt and now', () => {
    const quitAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-10T00:00:00Z');
    const sessions = [
      mkSession({ startedAt: '2026-01-02T00:00:00Z' }), // gap from quitAt: 1d
      mkSession({ startedAt: '2026-01-03T00:00:00Z' }), // gap: 1d
      // gap from 01-03 to now (01-10) = 7d, the largest
    ];
    expect(longestCravingFreeGapMs(sessions, quitAt, now)).toBe(7 * 86_400_000);
  });
});

describe('perTriggerStats', () => {
  it('returns {} for empty input', () => {
    expect(perTriggerStats([])).toEqual({});
  });

  it('computes total/passed/rate per trigger, null rate when nothing resolved', () => {
    const sessions = [
      mkSession({ trigger: 'stress', outcome: 'passed' }),
      mkSession({ trigger: 'stress', outcome: 'smoked' }),
      mkSession({ trigger: 'coffee', outcome: 'unresolved' }),
      mkSession({ trigger: 'coffee', outcome: null }),
    ];
    const result = perTriggerStats(sessions);
    expect(result.stress).toEqual({ total: 2, passed: 1, rate: 0.5 });
    expect(result.coffee).toEqual({ total: 2, passed: 0, rate: null });
  });
});

describe('alreadyProved', () => {
  const trigger: Trigger = 'stress';

  it('returns null with fewer than 3 resolved sessions for the trigger', () => {
    const sessions = [
      mkSession({ trigger, outcome: 'passed' }),
      mkSession({ trigger, outcome: 'passed' }),
    ];
    expect(alreadyProved(sessions, trigger)).toBeNull();
  });

  it('gates exactly at 3 resolved sessions', () => {
    const sessions = [
      mkSession({ trigger, outcome: 'passed' }),
      mkSession({ trigger, outcome: 'passed' }),
      mkSession({ trigger, outcome: 'smoked' }),
    ];
    expect(alreadyProved(sessions, trigger)).toEqual({ total: 3, passed: 2 });
  });

  it('does not count unresolved sessions toward the gate', () => {
    const sessions = [
      mkSession({ trigger, outcome: 'passed' }),
      mkSession({ trigger, outcome: 'passed' }),
      mkSession({ trigger, outcome: 'unresolved' }),
    ];
    expect(alreadyProved(sessions, trigger)).toBeNull();
  });
});

describe('weekStats', () => {
  it('counts sessions within [weekStart, +7d) and computes intensity/passRate', () => {
    const weekStart = new Date('2026-01-05T00:00:00Z');
    const sessions = [
      mkSession({ startedAt: '2026-01-05T00:00:00Z', initialIntensity: 4, outcome: 'passed' }), // in (boundary)
      mkSession({ startedAt: '2026-01-08T00:00:00Z', initialIntensity: 6, outcome: 'smoked' }), // in
      mkSession({ startedAt: '2026-01-12T00:00:00Z', initialIntensity: 10, outcome: 'passed' }), // out (== weekStart+7d)
    ];
    const result = weekStats(sessions, weekStart);
    expect(result.count).toBe(2);
    expect(result.avgInitialIntensity).toBe(5);
    expect(result.passRate).toBeCloseTo(0.5, 10);
  });

  it('returns zero/null shape for a week with no sessions', () => {
    const result = weekStats([], new Date('2026-01-05T00:00:00Z'));
    expect(result).toEqual({ count: 0, avgInitialIntensity: null, passRate: null });
  });
});

describe('firstWeekVsThisWeek', () => {
  it('returns null before the 14-day gate', () => {
    const quitAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(quitAt.getTime() + 14 * 86_400_000 - 1);
    expect(firstWeekVsThisWeek([], quitAt, now)).toBeNull();
  });

  it('returns stats at exactly the 14-day gate', () => {
    const quitAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(quitAt.getTime() + 14 * 86_400_000);
    const sessions = [
      mkSession({ startedAt: '2026-01-02T00:00:00Z', initialIntensity: 8 }), // in first week
    ];
    const result = firstWeekVsThisWeek(sessions, quitAt, now);
    expect(result).not.toBeNull();
    expect(result?.firstWeek.count).toBe(1);
    expect(result?.thisWeek).toBeDefined();
  });
});
