/**
 * Pure belief-state engine for the Freedom feature: turns a flat log of
 * `BeliefAssessment` rows into "where does each promise currently stand."
 *
 * All comparisons of "latest" go through the assessment's INSTANT
 * (`new Date(assessedAt).getTime()`), never a lexicographic string compare —
 * stored ISO strings carry differing UTC offsets, and comparing them as
 * strings can rank an earlier moment as "later" (see the `sortChronologically`
 * comment in `lib/persistence/dexieRepositories.ts` for the canonical example;
 * this module does not import from `lib/`, it just follows the same rule).
 *
 * Tie-break: when two assessments of the same belief land on the EXACT same
 * instant, the one that appears LATER in the input array wins. This is an
 * arbitrary but deterministic and stable choice — pinned by a test below —
 * made because there is no other signal to prefer one over the other.
 */

import type { Belief, BeliefAssessment } from '@/domain/types';
import { BELIEF_ORDER } from '@/data/beliefs';

export type BeliefGroupKey = 'seen-through' | 'working-through' | 'unexplored';

export type BeliefTrend = 'weakening' | 'holding';

function instant(a: BeliefAssessment): number {
  return new Date(a.assessedAt).getTime();
}

/**
 * The latest assessment per belief, by instant. On an exact-instant tie, the
 * later array element wins (see module comment).
 */
export function latestAssessments(
  assessments: BeliefAssessment[]
): Map<Belief, BeliefAssessment> {
  const latest = new Map<Belief, BeliefAssessment>();
  for (const a of assessments) {
    const current = latest.get(a.beliefId);
    if (current === undefined || instant(a) >= instant(current)) {
      latest.set(a.beliefId, a);
    }
  }
  return latest;
}

/**
 * Groups every belief in `BELIEF_ORDER` by the strength of its latest
 * assessment: `strength <= 1` is 'seen-through' (the promise has cracked),
 * `strength >= 2` is 'working-through' (still holding), and a belief with no
 * assessment at all is 'unexplored'. Re-assessing a belief at a higher
 * strength than before re-files it back into 'working-through' — there is no
 * one-way ratchet toward 'seen-through'. Each group lists its beliefs in
 * `BELIEF_ORDER` order, not insertion/assessment order.
 */
export function beliefGroups(
  assessments: BeliefAssessment[]
): Record<BeliefGroupKey, Belief[]> {
  const latest = latestAssessments(assessments);
  const groups: Record<BeliefGroupKey, Belief[]> = {
    'seen-through': [],
    'working-through': [],
    unexplored: [],
  };
  for (const belief of BELIEF_ORDER) {
    const a = latest.get(belief);
    if (a === undefined) {
      groups.unexplored.push(belief);
    } else if (a.strength <= 1) {
      groups['seen-through'].push(belief);
    } else {
      groups['working-through'].push(belief);
    }
  }
  return groups;
}

/**
 * Compares the last two assessments (by instant) of a single belief:
 * 'weakening' if the latest strength is strictly lower than the previous
 * one, 'holding' if it is the same or higher. Returns `null` if the belief
 * has fewer than two assessments. Feeds a calm "felt weaker than last time"
 * line — never a chart.
 */
export function beliefTrend(
  assessments: BeliefAssessment[],
  beliefId: Belief
): BeliefTrend | null {
  const forBelief = assessments.filter((a) => a.beliefId === beliefId);
  if (forBelief.length < 2) return null;

  const sorted = [...forBelief].sort((a, b) => instant(a) - instant(b));
  const previous = sorted[sorted.length - 2];
  const latest = sorted[sorted.length - 1];
  return latest.strength < previous.strength ? 'weakening' : 'holding';
}
