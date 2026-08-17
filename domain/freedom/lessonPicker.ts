/**
 * Deterministic picker for the Freedom feature's lessons: which booster to
 * lead with today, and how to rank the exercise library for a given user.
 *
 * Everything here is a pure function of its inputs. `pickDailyBooster` also
 * takes `now` because its tie-break rotates by local calendar day (via
 * `daysSinceEpoch`) — same lessons/assessments/cravings/now always produce
 * the same pick, and the pick changes only at local midnight, never mid-day.
 *
 * Scoring (shared by both functions):
 *   +2 per lesson belief currently in 'working-through' (still holding,
 *      per `beliefGroups` — the promise the user is actively working on).
 *   +1 per lesson trigger that is among the user's TOP triggers.
 *
 * "Top triggers" is defined as: every trigger tied for the MAXIMUM `total`
 * count in `perTriggerStats` (not, say, "the top 3" — with small counts
 * common early in a quit, ties at the max are the normal case, and picking
 * an arbitrary fixed-size top-N would silently favor whichever triggers
 * happen to iterate first). Empty when there are no craving sessions with a
 * trigger at all (max count 0 => no trigger qualifies as "top").
 */

import type { Belief, BeliefAssessment, CravingSession, Trigger } from '@/domain/types';
import type { FreedomLesson } from '@/data/freedomLessons';
import { beliefGroups } from '@/domain/freedom/beliefState';
import { perTriggerStats } from '@/domain/stats/cravingStats';
import { daysSinceEpoch } from '@/domain/time';

function topTriggers(cravings: CravingSession[]): Set<Trigger> {
  const stats = perTriggerStats(cravings);
  const entries = Object.entries(stats) as [
    Trigger,
    { total: number; passed: number; rate: number | null },
  ][];

  let max = 0;
  for (const [, entry] of entries) {
    if (entry.total > max) max = entry.total;
  }

  const top = new Set<Trigger>();
  if (max === 0) return top;
  for (const [trigger, entry] of entries) {
    if (entry.total === max) top.add(trigger);
  }
  return top;
}

function score(
  lesson: FreedomLesson,
  workingThrough: Set<Belief>,
  topTrig: Set<Trigger>
): number {
  let total = 0;
  for (const beliefId of lesson.beliefIds) {
    if (workingThrough.has(beliefId)) total += 2;
  }
  for (const triggerId of lesson.triggerIds) {
    if (topTrig.has(triggerId)) total += 1;
  }
  return total;
}

/**
 * Picks today's booster. Boosters tied for the top score rotate by local
 * calendar day (`dayNumber % candidateCount`, over just the tied
 * candidates, in their catalog order) — so a tie doesn't silently freeze on
 * the same lesson forever. With zero assessments and zero cravings every
 * booster scores 0, so ALL boosters are "tied" and the result is a pure
 * day-key rotation over the full booster list; a booster is still always
 * returned.
 *
 * Throws only if `lessons` contains no boosters at all — the catalog is
 * expected to always have at least one.
 */
export function pickDailyBooster(
  lessons: FreedomLesson[],
  assessments: BeliefAssessment[],
  cravings: CravingSession[],
  now: Date
): FreedomLesson {
  const boosters = lessons.filter((l) => l.kind === 'booster');
  if (boosters.length === 0) {
    throw new Error('pickDailyBooster: no booster lessons available');
  }

  const workingThrough = new Set(beliefGroups(assessments)['working-through']);
  const topTrig = topTriggers(cravings);

  let bestScore = -Infinity;
  let candidates: FreedomLesson[] = [];
  for (const lesson of boosters) {
    const s = score(lesson, workingThrough, topTrig);
    if (s > bestScore) {
      bestScore = s;
      candidates = [lesson];
    } else if (s === bestScore) {
      candidates.push(lesson);
    }
  }

  const dayNumber = daysSinceEpoch(now);
  return candidates[dayNumber % candidates.length];
}

/**
 * Ranks the exercise library best-first for a given user, returning at most
 * `limit` lessons. Unlike `pickDailyBooster`, this takes no `now`: ties here
 * break by stable catalog order — the order exercises appear in the input
 * `lessons` array — not by day-key rotation. (The brief's plan text
 * mentions day-key rotation for ties in general, but the binding signature
 * for `rankExercises` has no `now` parameter, so rotation is reserved for
 * the single daily booster; a ranked list of exercises stays stable across
 * a session and across days for the same input data.)
 */
export function rankExercises(
  lessons: FreedomLesson[],
  assessments: BeliefAssessment[],
  cravings: CravingSession[],
  limit: number
): FreedomLesson[] {
  const workingThrough = new Set(beliefGroups(assessments)['working-through']);
  const topTrig = topTriggers(cravings);

  const scored = lessons
    .filter((l) => l.kind === 'exercise')
    .map((lesson, index) => ({ lesson, index, score: score(lesson, workingThrough, topTrig) }));

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.index - b.index));

  return scored.slice(0, Math.max(0, limit)).map((s) => s.lesson);
}
