/**
 * Health milestone eligibility engine — pure functions that turn a list of
 * `HealthMilestone`s plus a `quitAt`/`now` pair into per-milestone status,
 * and the derived views the UI needs (hero "happening now" cards, the next
 * milestone countdown, recently-achieved/upcoming lists, and the time-band
 * timeline grouping).
 *
 * All functions are pure and take an explicit `now: Date` — nothing here
 * calls `Date.now()`. This module never imports `data/healthMilestones.ts`;
 * callers supply the milestone list.
 */

import type { HealthMilestone, MilestoneCategory } from '@/domain/types';
import { hoursBetween } from '@/domain/time';

const HOUR_MS = 3_600_000;

export type MilestoneStatus =
  | 'upcoming'
  | 'happening-now'
  | 'achieved'
  | 'no-timeline';

export interface MilestoneState {
  milestone: HealthMilestone;
  status: MilestoneStatus;
  progress?: number; // 0-1, only for window milestones in 'happening-now'
  startsInMs?: number; // only for 'upcoming'
  achievedForMs?: number; // only for 'achieved' (time since it completed/arrived)
  stillImproving?: boolean; // true for openEnded milestones that are 'achieved'
}

/** max(earliestHours * 0.5, 2) — a 'point' milestone glows from earliest to earliest + grace. */
export function graceWindowHours(earliestHours: number): number {
  return Math.max(earliestHours * 0.5, 2);
}

export function milestoneState(
  m: HealthMilestone,
  quitAt: Date,
  now: Date
): MilestoneState {
  const { timing } = m;
  const elapsedH = hoursBetween(quitAt, now);

  if (timing.kind === 'noTimeline') {
    return { milestone: m, status: 'no-timeline' };
  }

  if (timing.kind === 'window') {
    const { earliestHours, typicalUntilHours } = timing;
    if (elapsedH < earliestHours) {
      return {
        milestone: m,
        status: 'upcoming',
        startsInMs: (earliestHours - elapsedH) * HOUR_MS,
      };
    }
    if (elapsedH <= typicalUntilHours) {
      const progress =
        (elapsedH - earliestHours) / (typicalUntilHours - earliestHours);
      return { milestone: m, status: 'happening-now', progress };
    }
    return {
      milestone: m,
      status: 'achieved',
      achievedForMs: (elapsedH - typicalUntilHours) * HOUR_MS,
    };
  }

  if (timing.kind === 'point') {
    const { earliestHours } = timing;
    if (elapsedH < earliestHours) {
      return {
        milestone: m,
        status: 'upcoming',
        startsInMs: (earliestHours - elapsedH) * HOUR_MS,
      };
    }
    const grace = graceWindowHours(earliestHours);
    if (elapsedH <= earliestHours + grace) {
      return { milestone: m, status: 'happening-now' };
    }
    return {
      milestone: m,
      status: 'achieved',
      achievedForMs: (elapsedH - earliestHours) * HOUR_MS,
    };
  }

  // openEnded
  const { earliestHours } = timing;
  if (elapsedH < earliestHours) {
    return {
      milestone: m,
      status: 'upcoming',
      startsInMs: (earliestHours - elapsedH) * HOUR_MS,
    };
  }
  return {
    milestone: m,
    status: 'achieved',
    stillImproving: true,
    achievedForMs: (elapsedH - earliestHours) * HOUR_MS,
  };
}

export function computeMilestoneStates(
  all: HealthMilestone[],
  quitAt: Date,
  now: Date
): MilestoneState[] {
  return all.map((m) => milestoneState(m, quitAt, now));
}

/** The boundary (in elapsed hours) at which a dated milestone's state last changed. */
function achievementBoundaryHours(m: HealthMilestone): number | null {
  switch (m.timing.kind) {
    case 'window':
      return m.timing.typicalUntilHours;
    case 'point':
    case 'openEnded':
      return m.timing.earliestHours;
    default:
      return null;
  }
}

/**
 * All 'happening-now' states, ordered: window progress ascending (freshest
 * first), then points by earliestHours desc.
 *
 * Fallback: if none are happening-now, return the most recently achieved
 * dated milestone (max achievement boundary <= now), length 1. Empty only
 * when no dated milestone has been achieved yet (e.g. pre-quit).
 */
export function happeningNow(states: MilestoneState[]): MilestoneState[] {
  const active = states.filter((s) => s.status === 'happening-now');
  if (active.length > 0) {
    const windows = active
      .filter((s) => s.milestone.timing.kind === 'window')
      .sort((a, b) => (a.progress ?? 0) - (b.progress ?? 0));
    const points = active
      .filter((s) => s.milestone.timing.kind === 'point')
      .sort((a, b) => {
        const aEarliest =
          a.milestone.timing.kind === 'point' ? a.milestone.timing.earliestHours : 0;
        const bEarliest =
          b.milestone.timing.kind === 'point' ? b.milestone.timing.earliestHours : 0;
        return bEarliest - aEarliest;
      });
    return [...windows, ...points];
  }

  const achieved = states.filter((s) => s.status === 'achieved');
  if (achieved.length === 0) {
    return [];
  }
  let best = achieved[0];
  let bestBoundary = achievementBoundaryHours(best.milestone) ?? -Infinity;
  for (const s of achieved.slice(1)) {
    const boundary = achievementBoundaryHours(s.milestone) ?? -Infinity;
    if (boundary > bestBoundary) {
      best = s;
      bestBoundary = boundary;
    }
  }
  return [best];
}

/** Smallest earliestHours strictly > elapsed among dated milestones; null when none remain. */
export function nextMilestone(
  states: MilestoneState[],
  quitAt: Date,
  now: Date
): { state: MilestoneState; etaMs: number } | null {
  const elapsedH = hoursBetween(quitAt, now);
  let best: MilestoneState | null = null;
  let bestEarliest = Infinity;
  for (const s of states) {
    if (s.milestone.timing.kind === 'noTimeline') continue;
    const earliest = s.milestone.timing.earliestHours;
    if (earliest > elapsedH && earliest < bestEarliest) {
      best = s;
      bestEarliest = earliest;
    }
  }
  if (!best) return null;
  return { state: best, etaMs: (bestEarliest - elapsedH) * HOUR_MS };
}

/** Achieved states sorted by achievedForMs ascending (most recent first), first `limit`. */
export function recentlyAchieved(
  states: MilestoneState[],
  limit: number
): MilestoneState[] {
  return states
    .filter((s) => s.status === 'achieved')
    .sort((a, b) => (a.achievedForMs ?? 0) - (b.achievedForMs ?? 0))
    .slice(0, limit);
}

/** Upcoming states sorted by startsInMs ascending, first `limit`. */
export function upcomingSoon(
  states: MilestoneState[],
  limit: number
): MilestoneState[] {
  return states
    .filter((s) => s.status === 'upcoming')
    .sort((a, b) => (a.startsInMs ?? 0) - (b.startsInMs ?? 0))
    .slice(0, limit);
}

export const TIME_BANDS = [
  { id: 'first-20-minutes', label: 'First 20 minutes', untilHours: 1 },
  { id: 'first-day', label: 'First day', untilHours: 24 },
  { id: 'days-2-3', label: 'Days 2–3', untilHours: 72 },
  { id: 'first-week', label: 'First week', untilHours: 168 },
  { id: 'weeks-2-4', label: 'Weeks 2–4', untilHours: 730 },
  { id: 'months-1-3', label: 'Months 1–3', untilHours: 2190 },
  { id: 'months-3-12', label: 'Months 3–12', untilHours: 8766 },
  { id: 'years-1-5', label: 'Years 1–5', untilHours: 43830 },
  { id: 'years-5-15', label: 'Years 5–15', untilHours: 131490 },
  { id: 'beyond-15-years', label: '15+ years', untilHours: Infinity },
] as const;
export type TimeBandId = (typeof TIME_BANDS)[number]['id'];

/** By earliestHours; null for noTimeline. */
export function bandOf(m: HealthMilestone): TimeBandId | null {
  if (m.timing.kind === 'noTimeline') return null;
  const { earliestHours } = m.timing;
  for (const band of TIME_BANDS) {
    if (earliestHours <= band.untilHours) return band.id;
  }
  return null;
}

/** Dated milestones only, bands in order, empty bands omitted; within a band sort by earliestHours asc. */
export function groupByTimeBand(
  states: MilestoneState[]
): { band: (typeof TIME_BANDS)[number]; states: MilestoneState[] }[] {
  const result: { band: (typeof TIME_BANDS)[number]; states: MilestoneState[] }[] =
    [];
  for (const band of TIME_BANDS) {
    const inBand = states
      .filter((s) => bandOf(s.milestone) === band.id)
      .sort((a, b) => {
        const aE =
          a.milestone.timing.kind === 'noTimeline' ? 0 : a.milestone.timing.earliestHours;
        const bE =
          b.milestone.timing.kind === 'noTimeline' ? 0 : b.milestone.timing.earliestHours;
        return aE - bE;
      });
    if (inBand.length > 0) {
      result.push({ band, states: inBand });
    }
  }
  return result;
}

export function currentBandId(quitAt: Date, now: Date): TimeBandId {
  const elapsedH = hoursBetween(quitAt, now);
  for (const band of TIME_BANDS) {
    if (elapsedH <= band.untilHours) return band.id;
  }
  return TIME_BANDS[TIME_BANDS.length - 1].id;
}

/** total includes noTimeline entries; achieved/happeningNow only dated ones. */
export function categoryProgress(
  states: MilestoneState[]
): Partial<
  Record<MilestoneCategory, { achieved: number; happeningNow: number; total: number }>
> {
  const result: Partial<
    Record<MilestoneCategory, { achieved: number; happeningNow: number; total: number }>
  > = {};
  for (const s of states) {
    const category = s.milestone.category;
    const entry = result[category] ?? { achieved: 0, happeningNow: 0, total: 0 };
    entry.total += 1;
    if (s.status === 'achieved') entry.achieved += 1;
    if (s.status === 'happening-now') entry.happeningNow += 1;
    result[category] = entry;
  }
  return result;
}
