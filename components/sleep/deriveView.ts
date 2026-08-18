/**
 * The pure hero-state machine behind `/sleep`. Lives outside the component
 * (house rule: logic out of components) so it can be unit-tested directly —
 * see `tests/domain/sleepView.test.ts`.
 *
 * Native truth (`RecorderStatus`) always wins over stored rows: a row is
 * only ever rendered as live when the recorder itself says it is recording.
 * Recovery/adoption logic is deliberately NOT duplicated here — that is
 * entirely `SleepRecovery`/`SleepSessionService.recoverOnLaunch`'s job.
 */
import type { SleepSession } from '@/domain/types';
import { hoursBetween } from '@/domain/time';
import type { RecorderStatus } from '@/lib/recorder/types';

/**
 * How long a finished night keeps the hero slot as `MorningResults` before
 * automatically reverting to `PreSleepCard`. Anchored to `endedAt` (falling
 * back to `startedAt` for a 'failed' row that never got one) rather than a
 * calendar-day boundary: a session that starts at 23:18 and ends at 07:00
 * has "yesterday's" `startedAt` but should still show its results all
 * morning, and a 00:30 session must not pin results in place until midnight
 * with no way to start tonight's recording. 12h comfortably covers "the
 * rest of the day this night ended on" for any normal sleep schedule.
 *
 * Auto-reverting (rather than also adding a Start affordance inside
 * `MorningResults`) is the deliberate choice here: the hero stays a strict
 * one-card state machine, Start only ever lives on `PreSleepCard`, and
 * last night's numbers remain visible regardless via `SleepHistoryList`/
 * `SleepTrendSection` below.
 */
export const RESULTS_WINDOW_HOURS = 12;

/**
 * How long a not-yet-analyzed row ('recording' or 'recorded') may hold the
 * hero slot as `AnalyzingCard` before the hero reverts to `PreSleepCard`.
 *
 * This window is what stops the screen from bricking. Analysis normally
 * finishes in seconds, but it can also fail forever — a device that ignores
 * the requested 16kHz capture format rejects every `extractFeatures` retry
 * with `EXTRACTION_FAILED`, leaving the row stuck at 'recorded'. Without a
 * window, that row would pin the hero on a card that has no Start button,
 * making the whole feature unusable with no way out. Two hours is far longer
 * than any real analysis and still well inside the same morning, so a stuck
 * row gets its honest retry affordance first and only then steps aside.
 *
 * Stepping aside is not hiding: the row stays listed (with an honest state
 * label) and individually deletable in `SleepHistoryList`.
 */
export const ANALYZING_WINDOW_HOURS = 2;

export type SleepView =
  | { phase: 'loading' }
  | { phase: 'pre-sleep' }
  | { phase: 'active'; startedAtMs: number }
  | { phase: 'analyzing'; session: SleepSession }
  | { phase: 'results'; session: SleepSession };

/**
 * Hours since the row's own most recent timestamp: `endedAt` when it has one
 * (a stopped/analyzed/failed night), else `startedAt` (a row that never got
 * an `endedAt` — i.e. one still marked 'recording').
 */
function hoursSince(session: SleepSession, now: Date): number {
  return hoursBetween(new Date(session.endedAt ?? session.startedAt), now);
}

/**
 * Hours since a not-yet-analyzed row stopped producing audio.
 *
 * A row still marked 'recording' has no `endedAt` of its own, and its
 * `startedAt` is useless as an anchor for an overnight session — it would
 * call a night that ended thirty seconds ago eight hours stale. When native
 * remembers stopping exactly this session, its `endedAtMs` IS the real end
 * of the recording, so it is preferred; only a row native has no memory of
 * at all falls back to `startedAt` (which is the correct answer there: such a
 * row is genuinely lost, and recovery is about to mark it 'failed').
 */
function hoursSincePending(session: SleepSession, nativeStatus: RecorderStatus, now: Date): number {
  if (session.endedAt === undefined && nativeStatus.phase === 'stopped') {
    if (nativeStatus.sessionId === session.id && nativeStatus.endedAtMs !== undefined) {
      return hoursBetween(new Date(nativeStatus.endedAtMs), now);
    }
  }
  return hoursSince(session, now);
}

/**
 * Derives which single hero card to show from native truth (`nativeStatus`,
 * refreshed at mount and on every native resume) plus the latest stored row.
 *
 * `null` native status means "not resolved yet" -> 'loading'. Otherwise:
 * - native 'recording' -> 'active' (the ONLY way to reach 'active');
 * - latest row not yet analyzed, within `ANALYZING_WINDOW_HOURS` ->
 *   'analyzing' (with retry, for a 'recorded' row);
 * - latest row analyzed/failed within `RESULTS_WINDOW_HOURS` -> 'results';
 * - anything else -> 'pre-sleep', so Start is always reachable again.
 */
export function deriveView(
  nativeStatus: RecorderStatus | null,
  sessions: SleepSession[],
  now: Date
): SleepView {
  if (nativeStatus === null) return { phase: 'loading' };

  if (nativeStatus.phase === 'recording') {
    const session = sessions.find((s) => s.id === nativeStatus.sessionId);
    const startedAtMs =
      nativeStatus.startedAtMs ?? (session ? new Date(session.startedAt).getTime() : now.getTime());
    return { phase: 'active', startedAtMs };
  }

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  const latest = sorted[0];
  if (latest === undefined) return { phase: 'pre-sleep' };

  if (latest.state === 'recording' || latest.state === 'recorded') {
    // Native is NOT recording (checked above), so this row is either
    // mid-analysis or stuck. Honest while it's fresh, out of the way once
    // it's stale — see `ANALYZING_WINDOW_HOURS`.
    return hoursSincePending(latest, nativeStatus, now) < ANALYZING_WINDOW_HOURS
      ? { phase: 'analyzing', session: latest }
      : { phase: 'pre-sleep' };
  }

  if (
    (latest.state === 'analyzed' || latest.state === 'failed') &&
    hoursSince(latest, now) < RESULTS_WINDOW_HOURS
  ) {
    return { phase: 'results', session: latest };
  }

  return { phase: 'pre-sleep' };
}
