/**
 * Pure state-transition functions for a single night's `SleepSession` row,
 * plus the pure classifier that decides what launch-time recovery should do
 * with whatever rows survived from before the app closed.
 *
 * Like `sessionFinalizer.ts`, every function here is pure: explicit `now`/
 * inputs only, no clock or storage access, never mutates its argument. The
 * *orchestration* around these transitions (calling the recorder, persisting
 * rows, running analysis) lives in `sleepSessionService.ts` — this module
 * only ever answers "given this input, what should the row become?".
 */
import type { RecorderStatus, RecorderStopResult } from '@/lib/recorder/types';
import type { SleepSession, SleepSessionMetrics } from '@/domain/types';
import type { SnoreAnalysis } from '@/domain/snore/types';
import { toLocalIso } from '@/lib/utils/iso';

/**
 * The initial row written the moment recording starts — before we know how
 * the night ends. `preQuit` is computed and PINNED here rather than derived
 * later from `startedAt`/a live `quitAt`, because the user's quit date can
 * itself change after the fact (e.g. a corrected quit time); a night's
 * "was this before or after I quit" framing should reflect the quit date as
 * it stood *that night*, not whatever it is when the row is later read.
 */
export function buildSleepSession(input: {
  id: string;
  startedAt: Date;
  quitAt: Date | null;
}): SleepSession {
  return {
    id: input.id,
    startedAt: toLocalIso(input.startedAt),
    state: 'recording',
    preQuit: input.quitAt !== null && input.startedAt.getTime() < input.quitAt.getTime(),
  };
}

/** Recording stopped natively; full-night audio still exists on-device pending analysis. */
export function finalizeRecorded(s: SleepSession, result: RecorderStopResult): SleepSession {
  return {
    ...s,
    state: 'recorded',
    endedAt: toLocalIso(new Date(result.endedAtMs)),
    interrupted: result.interrupted,
  };
}

/**
 * Analysis completed successfully — the FINAL state. Note there is no
 * duration threshold gating this: a recording shorter than
 * `MIN_ANALYZABLE_MS` still becomes 'analyzed' with real, stored metrics.
 * `MIN_ANALYZABLE_MS` only gates which analyzed nights count toward TRENDS
 * (see `domain/snore/trends.ts`) — it is not a validity gate on the row
 * itself. 'failed' is reserved for nights with no analyzable audio at all.
 */
export function markAnalyzed(
  s: SleepSession,
  analysis: SnoreAnalysis,
  metrics: SleepSessionMetrics
): SleepSession {
  return {
    ...s,
    state: 'analyzed',
    analysisVersion: analysis.analysisVersion,
    metrics,
    events: analysis.events,
  };
}

/**
 * No analyzable audio survived. `endedAt` is pinned to the given `endedAt`
 * ONLY if the row doesn't already have one — a 'recorded' row (stopped
 * normally, analysis itself failed) already carries its real `endedAt` and
 * keeps it; a 'recording' row recovered with no native knowledge at all
 * (see `classifyPendingSessions`'s `lost` bucket) has none yet and gets the
 * caller-supplied value, which recovery pins to `startedAt` — never `now` —
 * so a row can never claim a multi-hour night just because the app happened
 * to reopen later (mirrors `sessionFinalizer.finalizeAbandoned`'s doctrine).
 */
export function markFailed(s: SleepSession, endedAt: Date): SleepSession {
  return {
    ...s,
    state: 'failed',
    endedAt: s.endedAt ?? toLocalIso(endedAt),
  };
}

export interface PendingClassification {
  /** A pending 'recording' row whose id matches a currently-live native session — adopt, no write needed. */
  live: SleepSession | null;
  /** Pending 'recording' rows whose id matches a native session the recorder already knows stopped. */
  finalize: { session: SleepSession; endedAtMs: number; interrupted: boolean }[];
  /** Pending 'recorded' rows — full-night audio should still exist natively; analysis is retried. */
  retryAnalysis: SleepSession[];
  /** Pending 'recording' rows with NO matching native audio or status at all — mark failed. */
  lost: SleepSession[];
}

/**
 * Buckets whatever rows survived a restart into what launch-time recovery
 * should do with each. `pending` is every row with `state !== 'analyzed'`
 * (a 'recorded' row always needs a retry attempt; a 'recording' row needs
 * native truth to resolve, since native — not this row — is the source of
 * truth for recording liveness).
 *
 * `nativeStopped` is the recorder's memory of the most recently stopped
 * session, if it has one (there is at most one "last stopped session" at a
 * time) — the service obtains it by calling `recorder.stop()` when
 * `status.recording` is false and catching a "nothing to stop" rejection,
 * which the native contract's `NOT_RECORDING` error already documents as
 * covering "no active/LAST session to act on" (see
 * `lib/native/snoreMonitor.ts`), i.e. re-stopping an already-stopped-but-
 * unclaimed session is expected to succeed and hand back its result.
 *
 * Clock-skew guard: if `nativeStopped.endedAtMs` would put the ended time
 * before the row's own `startedAt`, it is clamped up to `startedAt` (a
 * zero-length session) rather than producing a negative duration — this
 * never throws.
 */
export function classifyPendingSessions(
  pending: SleepSession[],
  status: RecorderStatus | { recording: false },
  nativeStopped?: { sessionId?: string; endedAtMs?: number; interrupted?: boolean }
): PendingClassification {
  let live: SleepSession | null = null;
  const finalize: PendingClassification['finalize'] = [];
  const retryAnalysis: SleepSession[] = [];
  const lost: SleepSession[] = [];

  for (const session of pending) {
    if (session.state === 'recorded') {
      retryAnalysis.push(session);
      continue;
    }

    // Only 'recording' rows remain — 'analyzed' is excluded by definition of
    // "pending", and 'failed' rows need no further recovery.
    if (status.recording && 'sessionId' in status && status.sessionId === session.id) {
      live = session;
      continue;
    }

    if (nativeStopped && nativeStopped.sessionId === session.id) {
      const startedAtMs = new Date(session.startedAt).getTime();
      const endedAtMs =
        nativeStopped.endedAtMs !== undefined
          ? Math.max(nativeStopped.endedAtMs, startedAtMs)
          : startedAtMs;
      finalize.push({ session, endedAtMs, interrupted: nativeStopped.interrupted ?? false });
      continue;
    }

    lost.push(session);
  }

  return { live, finalize, retryAnalysis, lost };
}
