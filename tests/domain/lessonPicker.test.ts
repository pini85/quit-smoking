import { describe, expect, it } from 'vitest';
import type { BeliefAssessment, CravingSession } from '@/domain/types';
import type { FreedomLesson } from '@/data/freedomLessons';
import { pickDailyBooster, rankExercises } from '@/domain/freedom/lessonPicker';

let idCounter = 0;

function mkLesson(overrides: Partial<FreedomLesson> = {}): FreedomLesson {
  idCounter += 1;
  return {
    id: `lesson-${idCounter}`,
    kind: 'booster',
    title: `Lesson ${idCounter}`,
    idea: 'idea',
    beliefIds: [],
    triggerIds: [],
    sourceKind: 'psych',
    principleRefs: ['A1'],
    ...overrides,
  };
}

function mkAssessment(overrides: Partial<BeliefAssessment> = {}): BeliefAssessment {
  idCounter += 1;
  return {
    id: `assessment-${idCounter}`,
    beliefId: 'relaxation',
    assessedAt: '2026-01-01T12:00:00Z',
    strength: 4,
    context: 'craving',
    ...overrides,
  };
}

function mkCraving(overrides: Partial<CravingSession> = {}): CravingSession {
  idCounter += 1;
  return {
    id: `craving-${idCounter}`,
    startedAt: '2026-01-01T12:00:00Z',
    initialIntensity: 5,
    outcome: 'passed',
    ...overrides,
  };
}

describe('pickDailyBooster', () => {
  it('is deterministic: same lessons/assessments/cravings/now always yields the same lesson', () => {
    const boosters = [mkLesson(), mkLesson(), mkLesson()];
    const assessments = [mkAssessment({ beliefId: 'reward', strength: 3 })];
    const cravings = [mkCraving({ trigger: 'stress' })];
    const now = new Date(2026, 7, 17, 10, 0, 0);

    const first = pickDailyBooster(boosters, assessments, cravings, now);
    const second = pickDailyBooster(boosters, assessments, cravings, now);
    expect(first).toBe(second);
    expect(first.id).toBe(boosters.find((b) => b.id === first.id)?.id);
  });

  it('ignores exercises entirely — only ever returns a booster', () => {
    const boosters = [mkLesson({ id: 'boost-1' })];
    const exercises = [mkLesson({ id: 'ex-1', kind: 'exercise' })];
    const now = new Date(2026, 7, 17, 10, 0, 0);
    const result = pickDailyBooster([...exercises, ...boosters], [], [], now);
    expect(result.kind).toBe('booster');
    expect(result.id).toBe('boost-1');
  });

  it('empty-data fallback: with zero assessments and zero cravings, still returns a lesson via pure day-key rotation over all boosters', () => {
    const boosters = [mkLesson({ id: 'a' }), mkLesson({ id: 'b' }), mkLesson({ id: 'c' })];
    // day 0 relative to local epoch-day math: use three consecutive local days
    // and confirm the pick cycles through all three boosters in catalog order,
    // i.e. selection is `dayNumber % boosters.length` over the (all-tied) list.
    const day0 = new Date(2026, 7, 17, 12, 0, 0);
    const day1 = new Date(2026, 7, 18, 12, 0, 0);
    const day2 = new Date(2026, 7, 19, 12, 0, 0);

    const picks = [
      pickDailyBooster(boosters, [], [], day0).id,
      pickDailyBooster(boosters, [], [], day1).id,
      pickDailyBooster(boosters, [], [], day2).id,
    ];
    // All three boosters are tied at score 0, so three consecutive local days
    // must rotate through all three distinct boosters (dayNumber % 3 cycles
    // through 0, 1, 2 in some rotation depending on the epoch-day parity).
    expect(new Set(picks).size).toBe(3);
    expect(picks.every((id) => boosters.some((b) => b.id === id))).toBe(true);
  });

  it('boundary: rotation changes exactly at local midnight, not at some other threshold', () => {
    const boosters = [mkLesson({ id: 'a' }), mkLesson({ id: 'b' })];
    const justBeforeMidnight = new Date(2026, 7, 17, 23, 59, 59, 999);
    const justAfterMidnight = new Date(2026, 7, 18, 0, 0, 0, 0);
    const sameDayEarlier = new Date(2026, 7, 17, 0, 0, 0, 0);

    const beforePick = pickDailyBooster(boosters, [], [], justBeforeMidnight);
    const earlierSameDayPick = pickDailyBooster(boosters, [], [], sameDayEarlier);
    const afterPick = pickDailyBooster(boosters, [], [], justAfterMidnight);

    // Same local day, any time of day: same pick.
    expect(beforePick.id).toBe(earlierSameDayPick.id);
    // Crossing local midnight (even by 1ms): the pick flips (2 tied boosters).
    expect(afterPick.id).not.toBe(beforePick.id);
  });

  it('working-through outranks seen-through: a booster tied to a working-through belief always wins over one tied to a seen-through belief, regardless of day', () => {
    const workingThroughBooster = mkLesson({ id: 'working', beliefIds: ['reward'] });
    const seenThroughBooster = mkLesson({ id: 'seen', beliefIds: ['identity'] });
    const assessments = [
      mkAssessment({ beliefId: 'reward', strength: 3 }), // working-through (>= 2)
      mkAssessment({ beliefId: 'identity', strength: 0 }), // seen-through (<= 1)
    ];
    const boosters = [seenThroughBooster, workingThroughBooster];

    for (const now of [
      new Date(2026, 7, 17, 10, 0, 0),
      new Date(2026, 7, 18, 10, 0, 0),
      new Date(2026, 7, 19, 10, 0, 0),
    ]) {
      const result = pickDailyBooster(boosters, assessments, [], now);
      expect(result.id).toBe('working');
    }
  });

  it('scores +1 for a booster whose trigger is among the top (max-count) triggers', () => {
    const stressBooster = mkLesson({ id: 'stress-one', triggerIds: ['stress'] });
    const boredomBooster = mkLesson({ id: 'boredom-one', triggerIds: ['boredom'] });
    // 'stress' logged twice, 'boredom' logged once: stress is the sole top trigger.
    const cravings = [
      mkCraving({ trigger: 'stress' }),
      mkCraving({ trigger: 'stress' }),
      mkCraving({ trigger: 'boredom' }),
    ];
    const now = new Date(2026, 7, 17, 10, 0, 0);
    const result = pickDailyBooster([boredomBooster, stressBooster], [], cravings, now);
    expect(result.id).toBe('stress-one');
  });

  it('top triggers can be a tie: multiple triggers sharing the max count are all "top"', () => {
    const stressBooster = mkLesson({ id: 'stress-one', triggerIds: ['stress'] });
    const boredomBooster = mkLesson({ id: 'boredom-one', triggerIds: ['boredom'] });
    const habitBooster = mkLesson({ id: 'habit-one', triggerIds: ['habit'] });
    // stress and boredom both logged twice (tied for max); habit only once.
    const cravings = [
      mkCraving({ trigger: 'stress' }),
      mkCraving({ trigger: 'stress' }),
      mkCraving({ trigger: 'boredom' }),
      mkCraving({ trigger: 'boredom' }),
      mkCraving({ trigger: 'habit' }),
    ];
    const boosters = [stressBooster, boredomBooster, habitBooster];

    // habit (score 0) never wins against the tied +1 scorers, on any day.
    for (const day of [17, 18, 19]) {
      const result = pickDailyBooster(boosters, [], cravings, new Date(2026, 7, day, 10, 0, 0));
      expect(result.id).not.toBe('habit-one');
    }
  });
});

describe('rankExercises', () => {
  it('is deterministic and best-first: higher-scoring exercises rank ahead of lower-scoring ones', () => {
    const strong = mkLesson({ id: 'strong', kind: 'exercise', beliefIds: ['reward'] });
    const weak = mkLesson({ id: 'weak', kind: 'exercise', beliefIds: ['identity'] });
    const assessments = [
      mkAssessment({ beliefId: 'reward', strength: 3 }), // working-through: +2
      mkAssessment({ beliefId: 'identity', strength: 0 }), // seen-through: +0
    ];
    const result = rankExercises([weak, strong], assessments, [], 10);
    expect(result.map((l) => l.id)).toEqual(['strong', 'weak']);
  });

  it('ignores boosters entirely — only ever returns exercises', () => {
    const booster = mkLesson({ id: 'boost-1' });
    const exercise = mkLesson({ id: 'ex-1', kind: 'exercise' });
    const result = rankExercises([booster, exercise], [], [], 10);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ex-1');
  });

  it('respects the limit, returning at most `limit` lessons even when more qualify', () => {
    const exercises = [
      mkLesson({ id: 'e1', kind: 'exercise' }),
      mkLesson({ id: 'e2', kind: 'exercise' }),
      mkLesson({ id: 'e3', kind: 'exercise' }),
      mkLesson({ id: 'e4', kind: 'exercise' }),
    ];
    const result = rankExercises(exercises, [], [], 2);
    expect(result).toHaveLength(2);
  });

  it('limit 0 returns an empty array', () => {
    const exercises = [mkLesson({ id: 'e1', kind: 'exercise' })];
    expect(rankExercises(exercises, [], [], 0)).toEqual([]);
  });

  it('ties break by stable catalog order (input array order), not by day or shuffling', () => {
    const exercises = [
      mkLesson({ id: 'e1', kind: 'exercise' }),
      mkLesson({ id: 'e2', kind: 'exercise' }),
      mkLesson({ id: 'e3', kind: 'exercise' }),
    ];
    // All tied at score 0 (no assessments, no cravings).
    const result = rankExercises(exercises, [], [], 10);
    expect(result.map((l) => l.id)).toEqual(['e1', 'e2', 'e3']);
  });

  it('working-through outranks seen-through in exercise ranking too', () => {
    const workingEx = mkLesson({ id: 'working', kind: 'exercise', beliefIds: ['reward'] });
    const seenEx = mkLesson({ id: 'seen', kind: 'exercise', beliefIds: ['identity'] });
    const assessments = [
      mkAssessment({ beliefId: 'reward', strength: 4 }),
      mkAssessment({ beliefId: 'identity', strength: 1 }),
    ];
    const result = rankExercises([seenEx, workingEx], assessments, [], 10);
    expect(result.map((l) => l.id)).toEqual(['working', 'seen']);
  });
});
