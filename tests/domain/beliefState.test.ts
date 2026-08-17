import { describe, expect, it } from 'vitest';
import type { Belief, BeliefAssessment } from '@/domain/types';
import { BELIEF_ORDER } from '@/data/beliefs';
import {
  latestAssessments,
  beliefGroups,
  beliefTrend,
} from '@/domain/freedom/beliefState';

let idCounter = 0;
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

describe('latestAssessments', () => {
  it('returns an empty map for empty input', () => {
    expect(latestAssessments([]).size).toBe(0);
  });

  it('picks the single assessment for a belief with only one', () => {
    const a = mkAssessment({ beliefId: 'reward', strength: 3 });
    const result = latestAssessments([a]);
    expect(result.get('reward')).toEqual(a);
  });

  it('picks the assessment with the LATEST instant, not the last string lexicographically', () => {
    // '2026-01-01T12:00:00+02:00' is 10:00 UTC — EARLIER than '2026-01-01T11:30:00Z' (11:30 UTC),
    // even though the +02:00 string sorts later lexicographically (its digits "12:00:00"
    // beat "11:30:00" in a plain string compare). If latestAssessments ever regresses to a
    // string compare, it will wrongly pick the earlier one below.
    const earlierByInstant = mkAssessment({
      beliefId: 'reward',
      assessedAt: '2026-01-01T12:00:00+02:00', // = 10:00 UTC
      strength: 4,
    });
    const laterByInstant = mkAssessment({
      beliefId: 'reward',
      assessedAt: '2026-01-01T11:30:00Z', // = 11:30 UTC
      strength: 1,
    });
    const result = latestAssessments([earlierByInstant, laterByInstant]);
    expect(result.get('reward')).toEqual(laterByInstant);
  });

  it('tie-break: when two assessments share the exact same instant, the later array element wins', () => {
    const first = mkAssessment({
      beliefId: 'identity',
      assessedAt: '2026-01-01T10:00:00Z',
      strength: 4,
    });
    const second = mkAssessment({
      beliefId: 'identity',
      assessedAt: '2026-01-01T12:00:00+02:00', // same instant as `first`: 10:00 UTC
      strength: 1,
    });
    const result = latestAssessments([first, second]);
    expect(result.get('identity')).toEqual(second);

    // and the reverse order picks the (now-later) first element
    const reversed = latestAssessments([second, first]);
    expect(reversed.get('identity')).toEqual(first);
  });

  it('tracks each belief independently', () => {
    const a = mkAssessment({ beliefId: 'reward', strength: 2 });
    const b = mkAssessment({ beliefId: 'identity', strength: 0 });
    const result = latestAssessments([a, b]);
    expect(result.get('reward')).toEqual(a);
    expect(result.get('identity')).toEqual(b);
  });
});

describe('beliefGroups', () => {
  it('empty input: all 18 beliefs land in unexplored, in BELIEF_ORDER order', () => {
    const groups = beliefGroups([]);
    expect(groups.unexplored).toEqual(BELIEF_ORDER);
    expect(groups['seen-through']).toEqual([]);
    expect(groups['working-through']).toEqual([]);
  });

  it('boundary: strength exactly 1 files as seen-through', () => {
    const a = mkAssessment({ beliefId: 'reward', strength: 1 });
    const groups = beliefGroups([a]);
    expect(groups['seen-through']).toEqual(['reward']);
    expect(groups['working-through']).toEqual([]);
  });

  it('boundary: strength exactly 2 files as working-through', () => {
    const a = mkAssessment({ beliefId: 'reward', strength: 2 });
    const groups = beliefGroups([a]);
    expect(groups['working-through']).toEqual(['reward']);
    expect(groups['seen-through']).toEqual([]);
  });

  it('strength 0 is seen-through, strength 4 is working-through', () => {
    const seen = mkAssessment({ beliefId: 'reward', strength: 0 });
    const working = mkAssessment({ beliefId: 'identity', strength: 4 });
    const groups = beliefGroups([seen, working]);
    expect(groups['seen-through']).toEqual(['reward']);
    expect(groups['working-through']).toEqual(['identity']);
  });

  it('re-strengthening: a later high-strength assessment re-files a belief from seen-through back to working-through', () => {
    const sawThrough = mkAssessment({
      beliefId: 'reward',
      assessedAt: '2026-01-01T10:00:00Z',
      strength: 0,
    });
    const relapsedBelief = mkAssessment({
      beliefId: 'reward',
      assessedAt: '2026-02-01T10:00:00Z',
      strength: 3,
    });
    const groups = beliefGroups([sawThrough, relapsedBelief]);
    expect(groups['working-through']).toEqual(['reward']);
    expect(groups['seen-through']).toEqual([]);
  });

  it('groups list beliefs in BELIEF_ORDER order, not input/insertion order', () => {
    // Insert in an order that is the reverse of BELIEF_ORDER for two beliefs
    // that both land in working-through.
    const idxA = BELIEF_ORDER.indexOf('life-worse');
    const idxB = BELIEF_ORDER.indexOf('relaxation');
    expect(idxB).toBeLessThan(idxA); // sanity: relaxation comes first in BELIEF_ORDER

    const later = mkAssessment({ beliefId: 'life-worse', strength: 3 });
    const earlier = mkAssessment({ beliefId: 'relaxation', strength: 3 });
    const groups = beliefGroups([later, earlier]);
    expect(groups['working-through']).toEqual(['relaxation', 'life-worse']);
  });

  it('a belief never assessed stays in unexplored while others are grouped', () => {
    const a = mkAssessment({ beliefId: 'reward', strength: 2 });
    const groups = beliefGroups([a]);
    expect(groups.unexplored).not.toContain('reward');
    expect(groups.unexplored).toContain('identity');
    expect(groups.unexplored.length).toBe(BELIEF_ORDER.length - 1);
  });
});

describe('beliefTrend', () => {
  const belief: Belief = 'reward';

  it('returns null when there are fewer than two assessments for the belief', () => {
    expect(beliefTrend([], belief)).toBeNull();
    const only = mkAssessment({ beliefId: belief, strength: 3 });
    expect(beliefTrend([only], belief)).toBeNull();
  });

  it('returns null when other beliefs have assessments but this one has none', () => {
    const a = mkAssessment({ beliefId: 'identity', strength: 3 });
    const b = mkAssessment({ beliefId: 'identity', strength: 1 });
    expect(beliefTrend([a, b], belief)).toBeNull();
  });

  it('"weakening" when the latest assessment is strictly lower than the previous one', () => {
    const older = mkAssessment({
      beliefId: belief,
      assessedAt: '2026-01-01T10:00:00Z',
      strength: 3,
    });
    const newer = mkAssessment({
      beliefId: belief,
      assessedAt: '2026-01-02T10:00:00Z',
      strength: 1,
    });
    expect(beliefTrend([older, newer], belief)).toBe('weakening');
  });

  it('"holding" when the latest assessment is equal to the previous one', () => {
    const older = mkAssessment({
      beliefId: belief,
      assessedAt: '2026-01-01T10:00:00Z',
      strength: 2,
    });
    const newer = mkAssessment({
      beliefId: belief,
      assessedAt: '2026-01-02T10:00:00Z',
      strength: 2,
    });
    expect(beliefTrend([older, newer], belief)).toBe('holding');
  });

  it('"holding" when the latest assessment is HIGHER than the previous one (only < counts as weakening)', () => {
    const older = mkAssessment({
      beliefId: belief,
      assessedAt: '2026-01-01T10:00:00Z',
      strength: 0,
    });
    const newer = mkAssessment({
      beliefId: belief,
      assessedAt: '2026-01-02T10:00:00Z',
      strength: 3,
    });
    expect(beliefTrend([older, newer], belief)).toBe('holding');
  });

  it('compares the LAST TWO by instant across mixed offsets and out-of-order input, ignoring a third older one', () => {
    const oldest = mkAssessment({
      beliefId: belief,
      assessedAt: '2025-12-01T10:00:00Z',
      strength: 4,
    });
    const previous = mkAssessment({
      beliefId: belief,
      assessedAt: '2026-01-01T13:00:00+02:00', // = 11:00 UTC
      strength: 3,
    });
    const latest = mkAssessment({
      beliefId: belief,
      assessedAt: '2026-01-01T12:00:00Z', // = 12:00 UTC, later than `previous`
      strength: 1,
    });
    // Shuffle input order to prove instant-based sorting, not array order.
    expect(beliefTrend([latest, oldest, previous], belief)).toBe('weakening');
  });
});
