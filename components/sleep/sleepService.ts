/**
 * Non-component glue for the /sleep screen: the single construction point
 * for a `SleepSessionService` wired to a live `DataStore` snapshot, plus a
 * handful of small presentational/orchestration helpers shared by more than
 * one `components/sleep/*` file. No detection/analysis logic lives here —
 * that stays in `domain/snore/*` and `lib/services/sleepSessionService.ts`,
 * which this file only ever consumes.
 */
import type { Locale, SleepSession } from '@/domain/types';
import type { SnoreComparison, SnoreTrends } from '@/domain/snore/trends';
import { formatCompact } from '@/domain/i18n/units';
import type { DataStore } from '@/lib/services/dataStore';
import type { SleepRecorder } from '@/lib/recorder/types';
import { SleepSessionService } from '@/lib/services/sleepSessionService';
import { interpolate, type Messages } from '@/lib/i18n';

/**
 * Builds the `SleepSessionService` the whole /sleep screen shares. Deps read
 * live from the `DataStore` snapshot (never captured once) so the service
 * always sees current preferences/sessions/quit date without ever needing
 * to be rebuilt.
 */
export function buildSleepSessionService(recorder: SleepRecorder, store: DataStore): SleepSessionService {
  return new SleepSessionService({
    recorder,
    store,
    getSessions: () => store.getSnapshot().sleepSessions,
    getPreferences: () => store.getSnapshot().preferences ?? undefined,
    getQuitAt: () => {
      const profile = store.getSnapshot().profile;
      return profile ? new Date(profile.quitAt) : null;
    },
  });
}

/** 'Xh Ym' (locale-aware units), omitting the hour part entirely below 1 hour. */
export function formatSleepDuration(ms: number, locale: Locale): string {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return formatCompact(minutes, 'minute', locale);
  return `${formatCompact(hours, 'hour', locale)} ${formatCompact(minutes, 'minute', locale)}`;
}

/**
 * Which bucket `computeSnoreTrends` used as the CURRENT side of every
 * `vsBaseline` comparison. Mirrors that function's own selection rule — the
 * rolling 7-night window whenever it is gated in, else the last analyzable
 * night alone — so callers never have to guess (or, worse, assume it is
 * always last night).
 */
export function vsBaselineCurrentBucket(trends: SnoreTrends): 'lastNight' | 'sevenNights' {
  return trends.sevenNightAvg !== null ? 'sevenNights' : 'lastNight';
}

/**
 * Compact '↓/↑/≈ N%' baseline-comparison line for `MorningResults` and the
 * progress entry card — deliberately vague about WHICH baseline (pre-quit
 * or first-nights) so it never implies more than "your own past nights".
 *
 * `currentBucket` (from `vsBaselineCurrentBucket`) names the near side
 * honestly, which the copy used to get wrong: once three nights land inside
 * the rolling window, `deltaPercent` is the 7-NIGHT MEAN versus the baseline,
 * not last night versus the baseline — and printing it directly under last
 * night's own stat tiles as "vs. your baseline" read as a last-night delta it
 * has never been. Computing a genuine last-night delta instead was the other
 * option; naming the number that already exists is the honest-and-simple one,
 * and it also stops two lines derived from the same comparison (here and the
 * trend section) from disagreeing about what they describe.
 */
export function formatVsBaselineCompact(
  deltaPercent: number,
  currentBucket: 'lastNight' | 'sevenNights',
  m: Messages['sleep']['results']
): string {
  if (currentBucket === 'sevenNights') {
    if (deltaPercent < 0) return interpolate(m.vsBaselineDown7, { percent: Math.abs(deltaPercent) });
    if (deltaPercent > 0) return interpolate(m.vsBaselineUp7, { percent: deltaPercent });
    return m.vsBaselineFlat7;
  }
  if (deltaPercent < 0) return interpolate(m.vsBaselineDown, { percent: Math.abs(deltaPercent) });
  if (deltaPercent > 0) return interpolate(m.vsBaselineUp, { percent: deltaPercent });
  return m.vsBaselineFlat;
}

/**
 * Full correlation-safe trend sentence for one `SnoreComparison`, e.g.
 * "Snore burden is down 21% since you stopped smoking." `sinceReference`
 * says which baseline `computeSnoreTrends` actually used — its `vsBaseline`
 * entries don't carry that themselves, so the caller passes 'preQuit'
 * whenever `trends.preQuitBaseline` is non-null, else 'firstNights'.
 * NEVER claims quitting caused the change — always phrased as "since",
 * describing a correlation in time, not causation.
 */
export function formatTrendDelta(
  comparison: SnoreComparison,
  sinceReference: 'preQuit' | 'firstNights',
  m: Messages['sleep']['trends']
): string {
  const metric = m.metricNames[comparison.metric];

  if (comparison.deltaPercent === 0) {
    return interpolate(
      sinceReference === 'preQuit' ? m.delta.unchangedSincePreQuit : m.delta.unchangedSinceFirstNights,
      { metric }
    );
  }

  const decreased = comparison.deltaPercent < 0;
  type DeltaKey = keyof Messages['sleep']['trends']['delta'];
  const key: DeltaKey = decreased
    ? sinceReference === 'preQuit'
      ? 'decreasedSincePreQuit'
      : 'decreasedSinceFirstNights'
    : sinceReference === 'preQuit'
      ? 'increasedSincePreQuit'
      : 'increasedSinceFirstNights';

  return interpolate(m.delta[key], { metric, percent: Math.abs(comparison.deltaPercent) });
}

/**
 * Deletes the given native clip files (best-effort — mirrors the service's
 * own non-fatal clip-delete handling) and persists every session whose
 * events reference one of them with `clipPath` cleared, so a stored row
 * never keeps pointing at audio that no longer exists.
 *
 * `clipPath` is cleared for EVERY row in `clipPaths`, not only the entries
 * native confirms it deleted, and that is deliberate. The native
 * `deleteClips` contract is per-entry (see `lib/native/snoreMonitor.ts`): a
 * path that resolves under the app's clip directory is really deleted, and a
 * path that does not — the imported-from-another-device case — never
 * referenced a file on this device in the first place. Either way the row
 * must stop pointing at it: the first because the file is gone, the second
 * because the reference was always dangling. Clearing all of them is
 * therefore both simpler and strictly more honest than trying to reconstruct
 * which entries native considered valid, which the contract does not report.
 */
export async function deleteClipsAndUpdateSessions(
  recorder: Pick<SleepRecorder, 'deleteClips'>,
  store: Pick<DataStore, 'updateSleepSession'>,
  sessions: SleepSession[],
  clipPaths: string[]
): Promise<void> {
  if (clipPaths.length === 0) return;

  try {
    await recorder.deleteClips(clipPaths);
  } catch {
    // Non-fatal: dangling clip files are harmless; the cleared `clipPath`
    // fields persisted below are the source of truth going forward.
  }

  const pathSet = new Set(clipPaths);
  for (const session of sessions) {
    if (!session.events?.some((e) => e.clipPath !== undefined && pathSet.has(e.clipPath))) continue;

    const events = session.events.map((event) => {
      if (event.clipPath === undefined || !pathSet.has(event.clipPath)) return event;
      const next = { ...event };
      delete next.clipPath;
      return next;
    });
    await store.updateSleepSession({ ...session, events });
  }
}
