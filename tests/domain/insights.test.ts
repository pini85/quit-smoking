import { describe, expect, it } from 'vitest';
import type { CravingSession, Trigger } from '@/domain/types';
import { INSIGHT_RULES, generateInsights } from '@/domain/stats/insights';

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

function findRule(kind: string) {
  const rule = INSIGHT_RULES.find((r) => r.kind === kind);
  if (!rule) throw new Error(`no rule for kind ${kind}`);
  return rule;
}

/** N sessions all at a given literal hour (embedded offset, UTC 'Z'), on 2026-01-01. */
function sessionsAtHour(hour: string, count: number): CravingSession[] {
  return Array.from({ length: count }, () => mkSession({ startedAt: `2026-01-01T${hour}:00:00Z` }));
}

describe('peak-hours', () => {
  const rule = findRule('peak-hours');
  const quitAt = new Date('2025-12-01T00:00:00Z');
  const now = new Date('2026-01-02T00:00:00Z');

  it('fires exactly AT threshold: 10 sessions, densest 3h window = 40%', () => {
    const sessions = [
      ...sessionsAtHour('19', 2),
      ...sessionsAtHour('20', 1),
      ...sessionsAtHour('21', 1), // window [19,22) = 4 of 10 = 40%
      ...sessionsAtHour('05', 1),
      ...sessionsAtHour('06', 1),
      ...sessionsAtHour('07', 1),
      ...sessionsAtHour('08', 1),
      ...sessionsAtHour('09', 1),
      ...sessionsAtHour('10', 1),
    ];
    expect(sessions).toHaveLength(10);
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight).not.toBeNull();
    expect(insight?.text).toBe(
      'Your cravings cluster between 19:00–22:00. A 9 pm craving is one you saw coming.'
    );
    expect(insight?.priority).toBe(1);
    expect(insight?.id).toBe('peak-hours');
  });

  it('stays silent just below the 40% share (30%, same 10-session total)', () => {
    const sessions = [
      ...sessionsAtHour('19', 1),
      ...sessionsAtHour('20', 1),
      ...sessionsAtHour('21', 1), // window = 3 of 10 = 30%
      ...sessionsAtHour('00', 1),
      ...sessionsAtHour('03', 1),
      ...sessionsAtHour('06', 1),
      ...sessionsAtHour('09', 1),
      ...sessionsAtHour('12', 1),
      ...sessionsAtHour('15', 1),
      ...sessionsAtHour('23', 1),
    ];
    expect(sessions).toHaveLength(10);
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('stays silent below the 10-session gate even at 100% concentration', () => {
    const sessions = sessionsAtHour('19', 9);
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('wraps midnight in the display (startHour 23, endHour 2 exclusive -> "23:00–02:00")', () => {
    const sessions = [
      ...sessionsAtHour('23', 2),
      ...sessionsAtHour('00', 1),
      ...sessionsAtHour('01', 1),
      ...sessionsAtHour('05', 1),
      ...sessionsAtHour('06', 1),
      ...sessionsAtHour('07', 1),
      ...sessionsAtHour('08', 1),
      ...sessionsAtHour('09', 1),
      ...sessionsAtHour('10', 1),
    ];
    expect(sessions).toHaveLength(10);
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight?.text.startsWith('Your cravings cluster between 23:00–02:00.')).toBe(true);
  });
});

describe('trigger-share', () => {
  const rule = findRule('trigger-share');
  const quitAt = new Date('2025-12-01T00:00:00Z');
  const now = new Date('2026-01-02T00:00:00Z');

  function withTrigger(trigger: Trigger, count: number): CravingSession[] {
    return Array.from({ length: count }, () => mkSession({ trigger }));
  }

  it('fires exactly AT threshold: 100 with-trigger sessions, top trigger = 25%', () => {
    // coffee (25) is the strict argmax; the remaining 75 are spread across
    // other triggers each below 25 so coffee wins outright, no tie-break needed.
    const sessions = [
      ...withTrigger('coffee', 25),
      ...withTrigger('stress', 19),
      ...withTrigger('boredom', 19),
      ...withTrigger('alcohol', 19),
      ...withTrigger('social', 18),
    ];
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight).not.toBeNull();
    expect(insight?.text).toBe('Coffee is linked to 25% of your recorded cravings.');
    expect(insight?.priority).toBe(2);
    expect(insight?.id).toBe('trigger-share:coffee');
  });

  it('stays silent just below the 25% share (24/100, still the top trigger)', () => {
    const sessions = [
      ...withTrigger('coffee', 24),
      ...withTrigger('stress', 19),
      ...withTrigger('boredom', 19),
      ...withTrigger('alcohol', 19),
      ...withTrigger('social', 19),
    ];
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('stays silent below the 8-with-trigger-sessions gate even at 100% share', () => {
    const sessions = withTrigger('coffee', 7);
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('counts only sessions WITH a trigger in the denominator (untriggered sessions ignored)', () => {
    const sessions = [
      ...withTrigger('coffee', 2),
      ...Array.from({ length: 20 }, () => mkSession({ trigger: undefined })),
    ];
    // 2/2 = 100% of the 2 triggered sessions, but gate needs >=8 WITH-trigger sessions.
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });
});

describe('intensity-decline', () => {
  const rule = findRule('intensity-decline');
  const quitAt = new Date('2025-12-01T00:00:00Z');
  const now = new Date('2026-01-02T00:00:00Z');

  function weekOfSessions(weekStartIso: string, intensity: number, count: number): CravingSession[] {
    return Array.from({ length: count }, (_, i) =>
      mkSession({
        startedAt: new Date(new Date(weekStartIso).getTime() + i * 3_600_000).toISOString(),
        initialIntensity: intensity,
      })
    );
  }

  it('fires exactly AT the 1.0 delta threshold across 2 qualifying weeks (>=5 sessions each)', () => {
    const sessions = [
      ...weekOfSessions('2026-01-05T00:00:00Z', 7, 5), // week one avg 7.0
      ...weekOfSessions('2026-01-19T00:00:00Z', 6, 5), // latest week avg 6.0 (delta 1.0)
    ];
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight).not.toBeNull();
    expect(insight?.text).toBe(
      'Your average craving intensity dropped from 7.0 in week one to 6.0 this week.'
    );
    expect(insight?.priority).toBe(3);
  });

  it('stays silent with only a 0.9 delta', () => {
    const sessions = [
      ...weekOfSessions('2026-01-05T00:00:00Z', 7, 5), // avg 7.0
      ...weekOfSessions('2026-01-19T00:00:00Z', 6.1, 5), // avg 6.1 (delta 0.9)
    ];
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('stays silent with only 1 qualifying week (needs >= 2 distinct ISO weeks)', () => {
    const sessions = weekOfSessions('2026-01-05T00:00:00Z', 7, 5);
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('stays silent when a week has only 4 sessions (just below the per-week gate)', () => {
    const sessions = [
      ...weekOfSessions('2026-01-05T00:00:00Z', 7, 4), // below 5 -> not qualifying
      ...weekOfSessions('2026-01-19T00:00:00Z', 6, 5),
    ];
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });
});

describe('frequency-decline', () => {
  const rule = findRule('frequency-decline');
  const quitAt = new Date(2026, 0, 5, 0, 0, 0); // Monday
  const dayMs = 86_400_000;

  function sessionsAt(dayOffsetFromQuit: number, count: number): CravingSession[] {
    const base = new Date(quitAt.getTime() + dayOffsetFromQuit * dayMs);
    return Array.from({ length: count }, (_, i) =>
      mkSession({ startedAt: new Date(base.getTime() + i * 3_600_000).toISOString() })
    );
  }

  it('fires exactly AT the 70% threshold (10 -> 0 -> 7), isolated from the monotonic branch', () => {
    const now = new Date(quitAt.getTime() + 22 * dayMs); // lands inside week 3 (partial, excluded)
    const sessions = [
      ...sessionsAt(0, 10), // full week 0 (quit week): 10
      // week 1: 0 (zero-filled)
      ...sessionsAt(14, 7), // full week 2 (latest full week): 7 -> 7/10 = 70%
    ];
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight).not.toBeNull();
    expect(insight?.text).toBe('Cravings are becoming less frequent: 10/week at the start, 7/week now.');
    expect(insight?.priority).toBe(4);
  });

  it('stays silent just above the 70% threshold (10 -> 15 -> 8, not monotonic either)', () => {
    const now = new Date(quitAt.getTime() + 22 * dayMs);
    const sessions = [...sessionsAt(0, 10), ...sessionsAt(7, 15), ...sessionsAt(14, 8)];
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('fires via the monotonic-non-increasing branch alone (10,9,8; ratio 80% > 70%)', () => {
    const now = new Date(quitAt.getTime() + 22 * dayMs);
    const sessions = [...sessionsAt(0, 10), ...sessionsAt(7, 9), ...sessionsAt(14, 8)];
    expect(rule.compute(sessions, quitAt, now)).not.toBeNull();
  });

  it('stays silent with an increasing trend (8,9,10)', () => {
    const now = new Date(quitAt.getTime() + 22 * dayMs);
    const sessions = [...sessionsAt(0, 8), ...sessionsAt(7, 9), ...sessionsAt(14, 10)];
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('stays silent below the 3-full-elapsed-weeks gate (only 2 full weeks)', () => {
    const now = new Date(quitAt.getTime() + 15 * dayMs); // inside week 2 -> only weeks 0,1 are full
    const sessions = [...sessionsAt(0, 10), ...sessionsAt(7, 0)];
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('stays silent when the full weeks have zero sessions total (no fabrication)', () => {
    const now = new Date(quitAt.getTime() + 22 * dayMs);
    // all sessions fall in the current (partial, excluded) week
    const sessions = sessionsAt(21, 5);
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });
});

describe('trigger-victory', () => {
  const rule = findRule('trigger-victory');
  const quitAt = new Date('2025-12-01T00:00:00Z');
  const now = new Date('2026-01-02T00:00:00Z');

  function passed(trigger: Trigger, count: number): CravingSession[] {
    return Array.from({ length: count }, () => mkSession({ trigger, outcome: 'passed' }));
  }

  it('fires exactly AT threshold: 5 passed for a trigger', () => {
    const sessions = passed('stress', 5);
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight).not.toBeNull();
    expect(insight?.text).toBe("You've passed 5 stress cravings. That loop is losing.");
    expect(insight?.priority).toBe(5);
    expect(insight?.id).toBe('trigger-victory:stress');
  });

  it('stays silent just below threshold: 4 passed', () => {
    const sessions = passed('stress', 4);
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('uses the correct lowercase label for a multi-word trigger', () => {
    const sessions = passed('after-food', 5);
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight?.text).toBe("You've passed 5 after food cravings. That loop is losing.");
  });
});

describe('avg-duration', () => {
  const rule = findRule('avg-duration');
  const quitAt = new Date('2025-12-01T00:00:00Z');
  const now = new Date('2026-01-02T00:00:00Z');

  function resolvedWithDuration(count: number, durationSec: number): CravingSession[] {
    return Array.from({ length: count }, () =>
      mkSession({
        outcome: 'passed',
        startedAt: '2026-01-01T00:00:00Z',
        endedAt: new Date(new Date('2026-01-01T00:00:00Z').getTime() + durationSec * 1000).toISOString(),
      })
    );
  }

  it('fires exactly AT threshold: 5 eligible sessions', () => {
    const sessions = resolvedWithDuration(5, 120); // 2 min average
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight).not.toBeNull();
    expect(insight?.text).toBe(
      'Your recorded cravings last about 2 minutes on average — and you outlast them.'
    );
    expect(insight?.priority).toBe(6);
  });

  it('stays silent just below threshold: 4 eligible sessions', () => {
    const sessions = resolvedWithDuration(4, 120);
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('clamps the display to a minimum of 1 minute for very short average durations', () => {
    const sessions = resolvedWithDuration(5, 10); // 10s avg -> would round to 0 min
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight?.text).toContain('about 1 minutes');
  });
});

describe('craving-free-record', () => {
  const rule = findRule('craving-free-record');
  const quitAt = new Date('2026-01-01T00:00:00Z');

  function fiveSessionsEndingAt(lastSessionOffsetHours: number): CravingSession[] {
    return Array.from({ length: 5 }, (_, i) =>
      mkSession({ startedAt: new Date(quitAt.getTime() + i * 3_600_000).toISOString() })
    ).map((s, i) =>
      i === 4 ? { ...s, startedAt: new Date(quitAt.getTime() + lastSessionOffsetHours * 3_600_000).toISOString() } : s
    );
  }

  it('fires exactly AT threshold: 5 sessions, gap exactly 48h', () => {
    const sessions = fiveSessionsEndingAt(4);
    const now = new Date(quitAt.getTime() + (4 + 48) * 3_600_000);
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight).not.toBeNull();
    expect(insight?.text).toBe('Your longest craving-free stretch so far: 2.0 days.');
    expect(insight?.priority).toBe(7);
  });

  it('stays silent just below threshold: gap 48h minus 1ms', () => {
    const sessions = fiveSessionsEndingAt(4);
    const now = new Date(quitAt.getTime() + (4 + 48) * 3_600_000 - 1);
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('stays silent below the 5-session gate (4 sessions) even with a huge gap', () => {
    const sessions = Array.from({ length: 4 }, (_, i) =>
      mkSession({ startedAt: new Date(quitAt.getTime() + i * 3_600_000).toISOString() })
    );
    const now = new Date(quitAt.getTime() + 240 * 3_600_000);
    expect(rule.compute(sessions, quitAt, now)).toBeNull();
  });

  it('formats as whole (rounded) days at/above the 3-day boundary', () => {
    const sessions = fiveSessionsEndingAt(4);
    const now = new Date(quitAt.getTime() + (4 + 72) * 3_600_000); // exactly 3.0 days
    const insight = rule.compute(sessions, quitAt, now);
    expect(insight?.text).toBe('Your longest craving-free stretch so far: 3 days.');
  });
});

describe('generateInsights', () => {
  it('returns [] for empty input', () => {
    expect(generateInsights([], new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))).toEqual([]);
  });

  it('sorts firing insights by priority ascending and respects the limit', () => {
    const quitAt = new Date('2025-11-01T00:00:00Z');
    const now = new Date('2026-01-02T00:00:00Z');
    // Trigger both avg-duration (priority 6) and trigger-victory (priority 5) rules.
    const sessions = [
      ...Array.from({ length: 5 }, () =>
        mkSession({
          trigger: 'stress',
          outcome: 'passed',
          startedAt: '2026-01-01T00:00:00Z',
          endedAt: '2026-01-01T00:02:00Z',
        })
      ),
    ];
    const insights = generateInsights(sessions, quitAt, now, 3);
    expect(insights.length).toBeGreaterThan(0);
    const priorities = insights.map((i) => i.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    expect(insights.length).toBeLessThanOrEqual(3);
  });

  it('caps output at `limit` even when more rules fire', () => {
    const quitAt = new Date('2025-11-01T00:00:00Z');
    const now = new Date('2026-01-02T00:00:00Z');
    const sessions = [
      ...Array.from({ length: 5 }, () =>
        mkSession({
          trigger: 'stress',
          outcome: 'passed',
          startedAt: '2026-01-01T00:00:00Z',
          endedAt: '2026-01-01T00:02:00Z',
        })
      ),
    ];
    const insights = generateInsights(sessions, quitAt, now, 1);
    expect(insights).toHaveLength(1);
  });

  it('dedupes to at most one insight per kind', () => {
    const quitAt = new Date('2025-11-01T00:00:00Z');
    const now = new Date('2026-01-02T00:00:00Z');
    const sessions = Array.from({ length: 5 }, () =>
      mkSession({
        trigger: 'stress',
        outcome: 'passed',
        startedAt: '2026-01-01T00:00:00Z',
        endedAt: '2026-01-01T00:02:00Z',
      })
    );
    const insights = generateInsights(sessions, quitAt, now, 10);
    const kinds = insights.map((i) => i.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});
