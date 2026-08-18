/**
 * Pure "craving" statistics — counts, intensities, triggers, timing.
 *
 * All functions are pure and take an explicit `now`/`quitAt` where they are
 * time-dependent — nothing here calls `Date.now()`. Unlike quit-stats,
 * `preQuit` sessions are NOT filtered here: callers decide whether to
 * include them, per global semantics ("INCLUDED in craving stats").
 */

import type { CravingSession, Trigger } from '@/domain/types';
import { isoWeekKey, localHourOf, startOfLocalWeek } from '@/domain/time';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function isResolved(s: CravingSession): boolean {
  return s.outcome !== null && s.outcome !== 'unresolved';
}

function isPassed(s: CravingSession): boolean {
  return isResolved(s) && s.outcome !== 'smoked';
}

export function resolvedSessions(s: CravingSession[]): CravingSession[] {
  return s.filter(isResolved);
}

export function cravingCounts(s: CravingSession[]): {
  total: number;
  resolved: number;
  passedWithoutSmoking: number;
  smoked: number;
  passRate: number | null;
} {
  const resolved = resolvedSessions(s);
  const smoked = resolved.filter((c) => c.outcome === 'smoked').length;
  const passedWithoutSmoking = resolved.length - smoked;
  const passRate = resolved.length === 0 ? null : passedWithoutSmoking / resolved.length;
  return { total: s.length, resolved: resolved.length, passedWithoutSmoking, smoked, passRate };
}

export function avgInitialIntensity(s: CravingSession[]): number | null {
  if (s.length === 0) return null;
  const sum = s.reduce((acc, c) => acc + c.initialIntensity, 0);
  return round1(sum / s.length);
}

export function avgFinalIntensity(s: CravingSession[]): number | null {
  const withValue = s.filter((c) => c.finalIntensity !== undefined);
  if (withValue.length === 0) return null;
  const sum = withValue.reduce((acc, c) => acc + (c.finalIntensity as number), 0);
  return round1(sum / withValue.length);
}

export function avgIntensityDrop(s: CravingSession[]): number | null {
  const withBoth = s.filter((c) => c.finalIntensity !== undefined);
  if (withBoth.length === 0) return null;
  const sum = withBoth.reduce(
    (acc, c) => acc + (c.initialIntensity - (c.finalIntensity as number)),
    0
  );
  return round1(sum / withBoth.length);
}

export function avgDurationSec(s: CravingSession[]): number | null {
  const eligible = resolvedSessions(s).filter((c) => c.endedAt !== undefined);
  if (eligible.length === 0) return null;
  const sum = eligible.reduce((acc, c) => {
    const startedAt = new Date(c.startedAt).getTime();
    const endedAt = new Date(c.endedAt as string).getTime();
    return acc + Math.max(0, endedAt - startedAt) / 1000;
  }, 0);
  return sum / eligible.length;
}

export function strongestTrigger(s: CravingSession[]): { trigger: Trigger; count: number } | null {
  const withTrigger = s.filter((c): c is CravingSession & { trigger: Trigger } => c.trigger !== undefined);
  if (withTrigger.length === 0) return null;

  const counts = new Map<Trigger, number>();
  const passedCounts = new Map<Trigger, number>();
  for (const c of withTrigger) {
    counts.set(c.trigger, (counts.get(c.trigger) ?? 0) + 1);
    if (isPassed(c)) {
      passedCounts.set(c.trigger, (passedCounts.get(c.trigger) ?? 0) + 1);
    }
  }

  let best: Trigger | null = null;
  for (const [trigger, count] of counts) {
    if (best === null) {
      best = trigger;
      continue;
    }
    const bestCount = counts.get(best) as number;
    if (count > bestCount) {
      best = trigger;
      continue;
    }
    if (count === bestCount) {
      const passedHere = passedCounts.get(trigger) ?? 0;
      const passedBest = passedCounts.get(best) ?? 0;
      if (passedHere > passedBest || (passedHere === passedBest && trigger < best)) {
        best = trigger;
      }
    }
  }

  return best === null ? null : { trigger: best, count: counts.get(best) as number };
}

/**
 * Buckets by the session's own embedded offset (via `localHourOf`), NOT by
 * device-local time. This is intentional and differs from `weeklyCounts`:
 * "what hour does my habit fire" is a property of the event itself and
 * should travel with the user (embedded offset), while weekly charts are
 * about the user's current device-local calendar. Do not "fix" this
 * divergence.
 */
export function hourHistogram(s: CravingSession[]): number[] {
  const buckets = new Array(24).fill(0);
  for (const c of s) {
    buckets[localHourOf(c.startedAt)] += 1;
  }
  return buckets;
}

/**
 * Densest contiguous 3-hour window in the hour histogram, wrapping midnight.
 * `endHour` is EXCLUSIVE — the window covers `[startHour, endHour)` mod 24
 * (e.g. `startHour: 23, endHour: 2` means 23:00-01:59, i.e. hours 23, 0, 1).
 * Ties (multiple windows with the same max count) resolve to the LOWEST
 * `startHour` — the loop only replaces the best on a strict `>` so the
 * first (smallest-index) maximum found while scanning 0..23 wins.
 */
export function hardestWindow(
  s: CravingSession[]
): { startHour: number; endHour: number; count: number } | null {
  if (s.length === 0) return null;
  const hist = hourHistogram(s);
  let bestStart = 0;
  let bestCount = -1;
  for (let start = 0; start < 24; start++) {
    const count = hist[start] + hist[(start + 1) % 24] + hist[(start + 2) % 24];
    if (count > bestCount) {
      bestCount = count;
      bestStart = start;
    }
  }
  return { startHour: bestStart, endHour: (bestStart + 3) % 24, count: bestCount };
}

/** Adds `days` to a copy of `d` via `setDate` — DST-safe, unlike raw-ms arithmetic. */
function addLocalDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Buckets by device-local ISO week (via `isoWeekKey`/`startOfLocalWeek`), NOT
 * by the session's embedded offset. This is intentional and differs from
 * `hourHistogram`: a weekly chart answers "how was my week in my current
 * life" (device-local calendar), while the hour histogram answers "what hour
 * does my habit fire" (a property of the event itself, so it uses the
 * embedded offset and travels with the user). Do not "fix" this divergence.
 */
export function weeklyCounts(
  s: CravingSession[],
  quitAt: Date,
  now: Date
): { weekKey: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of s) {
    const key = isoWeekKey(new Date(c.startedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const quitWeek = startOfLocalWeek(quitAt);
  const nowWeek = startOfLocalWeek(now);
  const from = quitWeek.getTime() <= nowWeek.getTime() ? quitWeek : nowWeek;
  const to = quitWeek.getTime() <= nowWeek.getTime() ? nowWeek : quitWeek;

  const result: { weekKey: string; count: number }[] = [];
  let cursor = from;
  while (cursor.getTime() <= to.getTime()) {
    const key = isoWeekKey(cursor);
    result.push({ weekKey: key, count: counts.get(key) ?? 0 });
    cursor = addLocalDays(cursor, 7);
  }
  return result;
}

/**
 * Max gap between consecutive events in [quitAt, session times..., now].
 * Sessions that started before `quitAt` (preQuit logging) are dropped before
 * measuring gaps — this metric answers "how long has the user gone without a
 * craving SINCE QUITTING," not time spent still smoking pre-quit.
 */
export function longestCravingFreeGapMs(s: CravingSession[], quitAt: Date, now: Date): number {
  const quitAtMs = quitAt.getTime();
  const sessionTimesSinceQuit = s
    .map((c) => new Date(c.startedAt).getTime())
    .filter((t) => t >= quitAtMs);
  const times = [quitAtMs, ...sessionTimesSinceQuit, now.getTime()].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
  }
  return Math.max(0, maxGap);
}

export function perTriggerStats(
  s: CravingSession[]
): Partial<Record<Trigger, { total: number; passed: number; rate: number | null }>> {
  const total = new Map<Trigger, number>();
  const resolvedCount = new Map<Trigger, number>();
  const passedCount = new Map<Trigger, number>();

  for (const c of s) {
    if (c.trigger === undefined) continue;
    total.set(c.trigger, (total.get(c.trigger) ?? 0) + 1);
    if (isResolved(c)) {
      resolvedCount.set(c.trigger, (resolvedCount.get(c.trigger) ?? 0) + 1);
      if (isPassed(c)) {
        passedCount.set(c.trigger, (passedCount.get(c.trigger) ?? 0) + 1);
      }
    }
  }

  const result: Partial<Record<Trigger, { total: number; passed: number; rate: number | null }>> = {};
  for (const [trigger, totalForTrigger] of total) {
    const resolvedForTrigger = resolvedCount.get(trigger) ?? 0;
    const passedForTrigger = passedCount.get(trigger) ?? 0;
    result[trigger] = {
      total: totalForTrigger,
      passed: passedForTrigger,
      rate: resolvedForTrigger === 0 ? null : passedForTrigger / resolvedForTrigger,
    };
  }
  return result;
}

/** Gate for the 'proof' intervention: needs >= 3 RESOLVED prior sessions with this trigger. */
export function alreadyProved(
  s: CravingSession[],
  trigger: Trigger
): { total: number; passed: number } | null {
  const relevant = resolvedSessions(s).filter((c) => c.trigger === trigger);
  if (relevant.length < 3) return null;
  const passed = relevant.filter((c) => c.outcome !== 'smoked').length;
  return { total: relevant.length, passed };
}

export interface WeekStats {
  count: number;
  avgInitialIntensity: number | null;
  passRate: number | null;
}

export function weekStats(s: CravingSession[], weekStart: Date): WeekStats {
  const weekEnd = addLocalDays(weekStart, 7);
  const inWeek = s.filter((c) => {
    const t = new Date(c.startedAt).getTime();
    return t >= weekStart.getTime() && t < weekEnd.getTime();
  });
  return {
    count: inWeek.length,
    avgInitialIntensity: avgInitialIntensity(inWeek),
    passRate: cravingCounts(inWeek).passRate,
  };
}

const FOURTEEN_DAYS_MS = 14 * 86_400_000;
const SEVEN_DAYS_MS = 7 * 86_400_000;

/**
 * null unless now >= quitAt + 14 days (the before-vs-now gate). Compares two
 * symmetric ROLLING 7-day windows rather than a full week vs. a partial
 * calendar week (which would bias the comparison depending on what weekday
 * "now" falls on): firstWeek = [quitAt, quitAt+7d), thisWeek = [now-7d, now).
 * The rolling `now - 7d` start is computed via plain ms arithmetic (fine for
 * a rolling window, unlike a calendar week) — `weekStats` then derives its
 * end from that start using the DST-safe `setDate(+7)` idiom.
 */
export function firstWeekVsThisWeek(
  s: CravingSession[],
  quitAt: Date,
  now: Date
): { firstWeek: WeekStats; thisWeek: WeekStats } | null {
  if (now.getTime() - quitAt.getTime() < FOURTEEN_DAYS_MS) return null;
  const rollingWindowStart = new Date(now.getTime() - SEVEN_DAYS_MS);
  return {
    firstWeek: weekStats(s, quitAt),
    thisWeek: weekStats(s, rollingWindowStart),
  };
}
