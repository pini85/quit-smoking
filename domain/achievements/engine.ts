/**
 * Achievement evaluation engine — turns an `AchievementDefinition[]` plus a
 * context (profile, cravings, already-unlocked ids, now) into the subset
 * whose conditions are newly met.
 *
 * Pure; explicit `now: Date`; never mutates; unlocking is monotonic — an
 * already-unlocked achievement is never reconsidered or revoked here, even
 * if a later slip would otherwise make its condition false again (e.g. a
 * smoke-free-hours badge stays earned even after a subsequent smoked
 * session, since it is measured from `quitAt`, not from the current streak).
 * Unlock persistence itself is a later task's job — this module only
 * decides "is this true right now."
 */

import type { AchievementCondition, AchievementDefinition, CravingSession, QuitProfile } from '@/domain/types';
import { hoursBetween } from '@/domain/time';
import { cigarettesAvoided, currentStreakStart, moneySaved } from '@/domain/stats/quitStats';
import { cravingCounts, perTriggerStats } from '@/domain/stats/cravingStats';

const HOUR_MS = 3_600_000;

export interface AchievementContext {
  profile: QuitProfile;
  cravings: CravingSession[];
  unlocked: ReadonlySet<string>;
  now: Date;
}

/**
 * Longest gap (ms) among: consecutive session `startedAt` values, and the
 * last session's `startedAt` to `now`. Returns null when there are no
 * sessions at all (the condition requires >= 1 session to ever be met).
 *
 * This intentionally differs from `cravingStats.longestCravingFreeGapMs`,
 * which anchors its gap sequence with `quitAt` and `now` as sentinels. Per
 * the achievements brief, "craving-free-hours" measures quiet stretches
 * between LOGGED EVENTS only — quitAt is not a session and is deliberately
 * excluded, and a lone session still counts (its gap to `now`). Reusing
 * `longestCravingFreeGapMs` here would silently change the semantics (it
 * would never return null, and would always include the quitAt->firstEvent
 * gap), so this is a small dedicated helper rather than a shared one.
 */
function longestGapBetweenSessionsMs(cravings: CravingSession[], now: Date): number | null {
  if (cravings.length === 0) return null;
  const times = cravings.map((c) => new Date(c.startedAt).getTime()).sort((a, b) => a - b);
  // Accumulate the max in a plain loop rather than `Math.max(0, ...gaps)` —
  // a spread of one entry per session would risk a RangeError (blowing
  // V8's argument-count limit) once a user has logged thousands of
  // sessions. Same pattern as `cravingStats.longestCravingFreeGapMs`.
  let maxGap = now.getTime() - times[times.length - 1];
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
  }
  return Math.max(0, maxGap);
}

/** Friday at 18:00 local time, on or after `from` (strictly later if `from` is already past this Friday's 18:00). */
function fridayEighteenOnOrAfter(from: Date): Date {
  const day = from.getDay(); // 0 = Sun .. 6 = Sat
  const daysUntilFriday = (5 - day + 7) % 7;
  const sameWeekCandidate = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
    18,
    0,
    0,
    0
  );
  const needsNextWeek = daysUntilFriday === 0 && sameWeekCandidate.getTime() < from.getTime();
  const result = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 18, 0, 0, 0);
  result.setDate(result.getDate() + (needsNextWeek ? 7 : daysUntilFriday));
  return result;
}

/**
 * The Fri 18:00 -> Mon 06:00 local span starting at `fridayEighteen`. Built
 * via local-date arithmetic (`setDate` then `setHours`), not raw ms math, so
 * DST transitions inside the span don't shift the wall-clock end time — same
 * idiom as `cravingStats.addLocalDays`.
 */
function weekendWindowEnd(fridayEighteen: Date): Date {
  const end = new Date(fridayEighteen);
  end.setDate(end.getDate() + 3); // Fri -> Mon
  end.setHours(6, 0, 0, 0);
  return end;
}

/**
 * True when a full Fri 18:00 -> Mon 06:00 local span fits entirely inside
 * [streakStart, now]. The earliest such span whose start is >= streakStart
 * is the only candidate worth checking: if it doesn't fit before `now`, no
 * later span will either. `streakStart` already excludes any smoked
 * session, so "no smoked session inside it" is guaranteed by construction
 * rather than checked separately.
 */
function hasQualifyingWeekend(streakStart: Date, now: Date): boolean {
  const start = fridayEighteenOnOrAfter(streakStart);
  const end = weekendWindowEnd(start);
  return end.getTime() <= now.getTime();
}

export function conditionMet(cond: AchievementCondition, ctx: AchievementContext): boolean {
  switch (cond.type) {
    case 'smoke-free-hours':
      return hoursBetween(new Date(ctx.profile.quitAt), ctx.now) >= cond.hours;
    case 'cigarettes-avoided':
      return cigarettesAvoided(ctx.profile, ctx.now) >= cond.count;
    case 'money-saved':
      return moneySaved(ctx.profile, ctx.now) >= cond.amount;
    case 'cravings-passed':
      // INCLUDE preQuit sessions — a beaten craving is a beaten craving.
      return cravingCounts(ctx.cravings).passedWithoutSmoking >= cond.count;
    case 'trigger-passed':
      return (perTriggerStats(ctx.cravings)[cond.trigger]?.passed ?? 0) >= cond.count;
    case 'craving-free-hours': {
      const gapMs = longestGapBetweenSessionsMs(ctx.cravings, ctx.now);
      return gapMs !== null && gapMs / HOUR_MS >= cond.hours;
    }
    case 'smoke-free-weekend': {
      const streakStart = currentStreakStart(new Date(ctx.profile.quitAt), ctx.cravings);
      return hasQualifyingWeekend(streakStart, ctx.now);
    }
  }
}

/**
 * Definitions whose condition is met AND id not already in `ctx.unlocked`.
 * Pure; never mutates `defs` or `ctx.unlocked`. Idempotent given a stable
 * `ctx`: re-evaluating with the previous result folded into `unlocked`
 * returns [].
 */
export function evaluateAchievements(
  defs: AchievementDefinition[],
  ctx: AchievementContext
): AchievementDefinition[] {
  return defs.filter((def) => !ctx.unlocked.has(def.id) && conditionMet(def.condition, ctx));
}

export function progressToward(
  def: AchievementDefinition,
  ctx: AchievementContext
): { current: number; target: number } {
  const cond = def.condition;
  switch (cond.type) {
    case 'smoke-free-hours': {
      const elapsed = hoursBetween(new Date(ctx.profile.quitAt), ctx.now);
      return { current: Math.min(Math.max(0, elapsed), cond.hours), target: cond.hours };
    }
    case 'cigarettes-avoided':
      return { current: cigarettesAvoided(ctx.profile, ctx.now), target: cond.count };
    case 'money-saved':
      return { current: Math.floor(moneySaved(ctx.profile, ctx.now)), target: cond.amount };
    case 'cravings-passed':
      return { current: cravingCounts(ctx.cravings).passedWithoutSmoking, target: cond.count };
    case 'trigger-passed':
      return {
        current: perTriggerStats(ctx.cravings)[cond.trigger]?.passed ?? 0,
        target: cond.count,
      };
    case 'craving-free-hours': {
      const gapMs = longestGapBetweenSessionsMs(ctx.cravings, ctx.now);
      const hours = gapMs === null ? 0 : gapMs / HOUR_MS;
      return { current: Math.min(Math.max(0, hours), cond.hours), target: cond.hours };
    }
    case 'smoke-free-weekend': {
      const streakStart = currentStreakStart(new Date(ctx.profile.quitAt), ctx.cravings);
      return { current: hasQualifyingWeekend(streakStart, ctx.now) ? 1 : 0, target: 1 };
    }
  }
}
