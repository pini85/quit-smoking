/**
 * Night-over-night snore trends, derived from stored per-night metrics.
 *
 * Pure; explicit `now`/`quitAt` (never `Date.now()`/argless `new Date()`).
 * Mirrors the insights doctrine in `domain/stats/insights.ts`: every gated
 * value is a hard numeric threshold, and this module never fabricates a
 * comparison — a bucket below its exact threshold is `null`/omitted rather
 * than shown with too little data behind it.
 */

import type { SleepSession, SleepSessionMetrics } from '@/domain/types';
import { MIN_ANALYZABLE_MS } from '@/domain/snore/constants';

export type SnoreTrendMetric = 'snoreDurationMs' | 'eventsPerHour' | 'avgIntensity' | 'snoreBurden';

export interface SnoreBaseline {
  nights: number;
  means: Record<SnoreTrendMetric, number>;
}

export interface SnoreComparison {
  metric: SnoreTrendMetric;
  current: number; // mean over the current bucket
  reference: number; // mean over the reference bucket
  deltaPercent: number; // Math.round(((current - reference) / reference) * 100); negative = decrease
}

export interface SnoreTrends {
  analyzableNights: number;
  lastNight: SleepSessionMetrics | null; // most recent analyzable night's stored metrics
  sevenNightAvg: SnoreBaseline | null; // nights within last 7 days of `now`; gate: >= MIN_NIGHTS_ROLLING
  firstNightsBaseline: SnoreBaseline | null; // chronologically first 7 analyzable nights; gate: >= MIN_NIGHTS_BASELINE
  preQuitBaseline: SnoreBaseline | null; // nights with preQuit === true (or inferred); gate: >= MIN_NIGHTS_PRE_QUIT
  vsBaseline: SnoreComparison[]; // see computeSnoreTrends doc comment for the selection rules
  nightSeries: { startedAt: string; snoreBurden: number; eventsPerHour: number }[]; // all analyzable nights, chronological
}

export const MIN_NIGHTS_ROLLING = 3;
export const MIN_NIGHTS_BASELINE = 5;
export const MIN_NIGHTS_PRE_QUIT = 3;

const TREND_METRICS: SnoreTrendMetric[] = ['snoreDurationMs', 'eventsPerHour', 'avgIntensity', 'snoreBurden'];
const SEVEN_DAYS_MS = 7 * 86_400_000;
const FIRST_NIGHTS_WINDOW = 7;

/** An analyzable night, pre-resolved: epoch for sorting, preQuit resolved once. */
interface Night {
  id: string;
  startedAt: string;
  startedAtMs: number;
  metrics: SleepSessionMetrics;
  isPreQuit: boolean;
}

/**
 * Analyzable night: `state === 'analyzed'` AND `metrics` present AND
 * `metrics.recordingDurationMs >= MIN_ANALYZABLE_MS`. Anything else
 * ('recording'/'recorded'/'failed', or a malformed 'analyzed' row missing
 * `metrics`, or a too-short recording) is excluded from every bucket and
 * from `nightSeries`.
 */
function isAnalyzable(session: SleepSession): session is SleepSession & { metrics: SleepSessionMetrics } {
  return (
    session.state === 'analyzed' &&
    session.metrics !== undefined &&
    session.metrics.recordingDurationMs >= MIN_ANALYZABLE_MS
  );
}

/**
 * `preQuit` is read from the stored flag when present. `quitAt` is used
 * ONLY as a fallback for rows missing the flag (imported/legacy rows):
 * such a row counts as preQuit iff `quitAt` is non-null and the night's
 * `startedAt` is before it.
 */
function resolvePreQuit(session: SleepSession, quitAt: Date | null): boolean {
  if (session.preQuit !== undefined) return session.preQuit;
  if (quitAt === null) return false;
  return new Date(session.startedAt).getTime() < quitAt.getTime();
}

/** Plain arithmetic mean per metric over a bucket of nights. Caller guarantees nights.length > 0. */
function meansOf(nights: Night[]): Record<SnoreTrendMetric, number> {
  const means = {} as Record<SnoreTrendMetric, number>;
  for (const metric of TREND_METRICS) {
    const sum = nights.reduce((acc, n) => acc + n.metrics[metric], 0);
    means[metric] = sum / nights.length;
  }
  return means;
}

function baselineOf(nights: Night[]): SnoreBaseline {
  return { nights: nights.length, means: meansOf(nights) };
}

/**
 * Turns stored nightly metrics into gated night-over-night comparisons.
 * Sessions may arrive unsorted; sorted internally by `startedAt` compared as
 * epoch millis (`new Date(...).getTime()`) — a plain string compare is NOT
 * reliable across differing UTC offsets. Nights with different
 * `analysisVersion` values are compared as-is (documented limitation: no
 * cross-version normalization is attempted).
 *
 * `vsBaseline` selection:
 * - Current bucket = `sevenNightAvg` if gated in, else the last analyzable
 *   night alone (if any); if neither, there is no current bucket.
 * - Reference bucket = `preQuitBaseline` if gated in, else
 *   `firstNightsBaseline` if gated in, else there are NO comparisons.
 * - Non-overlap: nights already in the current bucket are removed from the
 *   reference bucket before it is (re-)gated — a night can't be its own
 *   baseline. If this exclusion drops the reference below its own gate,
 *   there are NO comparisons.
 * - Per metric, if the (post-exclusion) reference mean is 0 that metric's
 *   comparison is omitted entirely (never divide by zero / emit a garbage
 *   percent) while other metrics are still compared.
 * - `deltaPercent` is `Math.round(((current - reference) / reference) * 100)`,
 *   sign preserved.
 */
export function computeSnoreTrends(sessions: SleepSession[], quitAt: Date | null, now: Date): SnoreTrends {
  const nowMs = now.getTime();

  const analyzable: Night[] = sessions
    .filter(isAnalyzable)
    .map((session) => ({
      id: session.id,
      startedAt: session.startedAt,
      startedAtMs: new Date(session.startedAt).getTime(),
      metrics: session.metrics,
      isPreQuit: resolvePreQuit(session, quitAt),
    }))
    .sort((a, b) => a.startedAtMs - b.startedAtMs);

  const analyzableNights = analyzable.length;
  const lastNight = analyzableNights > 0 ? analyzable[analyzableNights - 1].metrics : null;

  const rollingWindow = analyzable.filter((n) => nowMs - n.startedAtMs < SEVEN_DAYS_MS);
  const sevenNightAvg = rollingWindow.length >= MIN_NIGHTS_ROLLING ? baselineOf(rollingWindow) : null;

  const first7 = analyzable.slice(0, FIRST_NIGHTS_WINDOW);
  const firstNightsBaseline = first7.length >= MIN_NIGHTS_BASELINE ? baselineOf(first7) : null;

  const preQuitNights = analyzable.filter((n) => n.isPreQuit);
  const preQuitBaseline = preQuitNights.length >= MIN_NIGHTS_PRE_QUIT ? baselineOf(preQuitNights) : null;

  const currentBucket: Night[] =
    sevenNightAvg !== null ? rollingWindow : lastNight !== null ? [analyzable[analyzableNights - 1]] : [];

  let referenceBucket: Night[] = [];
  let referenceGate = 0;
  if (preQuitBaseline !== null) {
    referenceBucket = preQuitNights;
    referenceGate = MIN_NIGHTS_PRE_QUIT;
  } else if (firstNightsBaseline !== null) {
    referenceBucket = first7;
    referenceGate = MIN_NIGHTS_BASELINE;
  }

  const vsBaseline: SnoreComparison[] = [];
  if (currentBucket.length > 0 && referenceBucket.length > 0) {
    const currentIds = new Set(currentBucket.map((n) => n.id));
    const exclusiveReference = referenceBucket.filter((n) => !currentIds.has(n.id));
    if (exclusiveReference.length >= referenceGate) {
      const currentMeans = meansOf(currentBucket);
      const referenceMeans = meansOf(exclusiveReference);
      for (const metric of TREND_METRICS) {
        const reference = referenceMeans[metric];
        if (reference === 0) continue;
        const current = currentMeans[metric];
        vsBaseline.push({
          metric,
          current,
          reference,
          deltaPercent: Math.round(((current - reference) / reference) * 100),
        });
      }
    }
  }

  const nightSeries = analyzable.map((n) => ({
    startedAt: n.startedAt,
    snoreBurden: n.metrics.snoreBurden,
    eventsPerHour: n.metrics.eventsPerHour,
  }));

  return {
    analyzableNights,
    lastNight,
    sevenNightAvg,
    firstNightsBaseline,
    preQuitBaseline,
    vsBaseline,
    nightSeries,
  };
}
