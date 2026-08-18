/**
 * Orchestrates a night's `SleepSession` row through its full lifecycle:
 * start -> stop -> analyze -> (eventually) delete, plus launch-time
 * recovery of whatever rows survived a restart. The native recorder
 * (`SleepRecorder`) is the SOLE source of truth for recording liveness —
 * this service never infers "is something recording?" from a stored row,
 * only from `recorder.getStatus()` (see `classifyPendingSessions`'s doc).
 *
 * Pure state transitions live in `sleepSessionLifecycle.ts`; this module is
 * the impure glue that calls the recorder, persists rows via `DataStore`'s
 * write-throughs, and sequences the two safely. The single most
 * safety-critical ordering in this file: `analyzeSession` persists the
 * 'analyzed' row (with its metrics) BEFORE asking the recorder to delete
 * the underlying audio — a user's night must never be deleted before its
 * metrics are durably stored.
 */
import type { DataStore } from '@/lib/services/dataStore';
import type { SleepRecorder, ClipRange, RecorderStopResult } from '@/lib/recorder/types';
import type { Preferences, SleepSession } from '@/domain/types';
import type { FeatureFrame } from '@/domain/snore/types';
import { createSnoreDetector } from '@/domain/snore/detect';
import { computeMetrics } from '@/domain/snore/metrics';
import { MAX_CLIPS_PER_NIGHT, CLIP_PADDING_MS } from '@/domain/snore/constants';
import {
  buildSleepSession,
  finalizeRecorded,
  markAnalyzed,
  markFailed,
  classifyPendingSessions,
} from '@/lib/services/sleepSessionLifecycle';

export interface SleepSessionServiceDeps {
  recorder: SleepRecorder;
  store: Pick<DataStore, 'addSleepSession' | 'updateSleepSession' | 'removeSleepSession' | 'clearSleepSessions'>;
  /** Current sleep-session rows (all states) — e.g. `() => dataStore.getSnapshot().sleepSessions`. */
  getSessions: () => SleepSession[];
  getPreferences: () => Preferences | undefined;
  getQuitAt: () => Date | null;
}

/** True when `error` is (or carries) the native `SESSION_NOT_FOUND` code documented in `lib/native/snoreMonitor.ts`. */
function isSessionNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: unknown }).code;
  return code === 'SESSION_NOT_FOUND' || error.message.includes('SESSION_NOT_FOUND');
}

/** `endedAt - startedAt`, clamped to >= 0 (clock-skew guard — never negative). */
function fallbackDurationMs(session: SleepSession): number {
  if (!session.endedAt) return 0;
  return Math.max(0, new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime());
}

function clipPathsOf(sessions: SleepSession[]): string[] {
  const paths: string[] = [];
  for (const session of sessions) {
    for (const event of session.events ?? []) {
      if (event.clipPath !== undefined) paths.push(event.clipPath);
    }
  }
  return paths;
}

export class SleepSessionService {
  constructor(private readonly deps: SleepSessionServiceDeps) {}

  /**
   * Best-effort native audio deletion — every caller treats a rejection as
   * non-fatal, and a rejection is genuinely expected in normal operation:
   * `deleteSessionAudio` only knows about the ONE session native currently
   * holds, so it answers `SESSION_NOT_FOUND` for any older night, and an
   * imported row never had audio on this device to begin with.
   *
   * Non-fatal must not mean "skipped", though: a night's full recording is
   * the most sensitive thing this app ever writes to disk, so every path that
   * ends a night — analyzed, provably unanalyzable, or deleted by the user —
   * goes through here rather than leaving the audio for some later pass.
   */
  private async tryDeleteRecording(sessionId: string, keepClips: boolean): Promise<void> {
    try {
      await this.deps.recorder.deleteRecording(sessionId, keepClips);
    } catch {
      // See this method's doc — expected for any session native has moved
      // past. Leftover audio, if any, is retried by the next delete path.
    }
  }

  /**
   * If native is already recording (e.g. a previous `startMonitoring` call,
   * or an in-progress night from before this service instance existed),
   * adopts that session instead of starting a second one — a double-start
   * is a no-op that returns the existing row. Otherwise starts a fresh
   * native recording and persists its row. A native start failure
   * propagates (rethrown) with no row written.
   */
  async startMonitoring(now: Date): Promise<SleepSession> {
    const status = await this.deps.recorder.getStatus();
    if (status.phase === 'recording' && status.sessionId !== undefined) {
      const sessionId = status.sessionId;
      const existing = this.deps.getSessions().find((s) => s.id === sessionId);
      if (existing) return existing;

      const adopted = buildSleepSession({
        id: sessionId,
        startedAt: status.startedAtMs !== undefined ? new Date(status.startedAtMs) : now,
        quitAt: this.deps.getQuitAt(),
      });
      await this.deps.store.addSleepSession(adopted);
      return adopted;
    }

    const id = crypto.randomUUID();
    const result = await this.deps.recorder.start(id);
    const session = buildSleepSession({
      id: result.sessionId,
      startedAt: new Date(result.startedAtMs),
      quitAt: this.deps.getQuitAt(),
    });
    await this.deps.store.addSleepSession(session);
    return session;
  }

  /**
   * Stops (or claims) whatever session native is holding, then finalizes and
   * analyzes it.
   *
   * Both non-idle native phases are acted on:
   * - 'recording' — the normal case: stop the live recording.
   * - 'stopped' — native already ended the session on its own (the
   *   notification's Stop action, a recorder error, low storage) and nobody
   *   has claimed the result yet. Claiming it here is what keeps such a night
   *   from stranding the UI: `stop()` is idempotent-when-stopped per the
   *   plugin contract (`lib/native/snoreMonitor.ts`) and simply returns the
   *   already-persisted `StopResult`, so this is the same code path with the
   *   same authoritative timestamps. Returning `null` instead — as this used
   *   to — left the row at 'recording'/'recorded' with nothing to move it on.
   *
   * Double-stop is still a no-op: once a first call has finished, native is
   * 'idle' (its `deleteSessionAudio` clears the store), so this returns
   * `null` without touching the recorder or any row.
   */
  async stopMonitoring(now: Date): Promise<SleepSession | null> {
    // `now` is accepted (unused) for symmetry with the other explicit-`now`
    // methods — every timestamp this method needs comes from the recorder's
    // own `stop()` result, which is authoritative.
    void now;

    const status = await this.deps.recorder.getStatus();
    if (status.phase === 'idle') return null;

    const result = await this.deps.recorder.stop();
    let session = this.deps.getSessions().find((s) => s.id === result.sessionId);
    if (!session) {
      session = buildSleepSession({
        id: result.sessionId,
        startedAt: new Date(result.startedAtMs),
        quitAt: this.deps.getQuitAt(),
      });
      await this.deps.store.addSleepSession(session);
    }

    const finalized = finalizeRecorded(session, result);
    await this.deps.store.updateSleepSession(finalized);
    return this.analyzeSession(finalized, result.durationMs);
  }

  /**
   * Runs detection + metrics for a 'recording'-turned-'recorded' or
   * previously-'recorded' (retry) row and persists the outcome.
   *
   * `recordingDurationMs`, when supplied (the fresh stop -> analyze path),
   * is the native recorder's own exact millisecond duration — preferred
   * over deriving it from `endedAt - startedAt`, which loses sub-second
   * precision (both are second-granularity `toLocalIso` strings). A retry
   * of an already-'recorded' row has no stop result to hand in, so it falls
   * back to that derived (clamped >= 0) duration.
   *
   * A recording shorter than `MIN_ANALYZABLE_MS` still completes and is
   * stored as 'analyzed' — see `markAnalyzed`'s doc, as long as it actually
   * decoded to at least one feature frame. `markFailed` is reserved for
   * truly unanalyzable sessions: ZERO feature frames (nothing decoded at
   * all — NOT the same as a real quiet night, which still has plenty of
   * low-RMS frames and simply produces zero snore *events*), or native
   * reporting `SESSION_NOT_FOUND`.
   *
   * Ordering is safety-critical: the terminal row — 'analyzed' with its
   * metrics, or 'failed' for zero frames — is persisted BEFORE
   * `deleteRecording` is ever called, so a crash or thrown error between the
   * two leaves the audio intact rather than losing a night's data. Any error
   * thrown before that persist (e.g. detector failure) propagates and leaves
   * the row in 'recorded' — the UI can offer a retry, which calls this
   * method again over the same audio.
   *
   * Both terminal paths DO delete: an 'analyzed' night's audio has served its
   * purpose, and a zero-frames night's audio is provably unanalyzable. Only
   * the `SESSION_NOT_FOUND` path skips deletion, because there is by
   * definition nothing left to delete.
   */
  async analyzeSession(session: SleepSession, recordingDurationMs?: number): Promise<SleepSession> {
    let frames: FeatureFrame[];
    try {
      frames = await this.deps.recorder.getFeatures(session.id);
    } catch (error) {
      if (!isSessionNotFoundError(error)) throw error;
      // No audio survived natively at all — this session can never be
      // analyzed. Pin to `startedAt`, never a clock read; the domain
      // `markFailed` only uses this if the row has no `endedAt` yet.
      const failed = markFailed(session, new Date(session.startedAt));
      await this.deps.store.updateSleepSession(failed);
      return failed;
    }

    if (frames.length === 0) {
      // Nothing decoded at all — e.g. a corrupt or empty audio file. This
      // is NOT a "quiet night" (which still yields many frames, just no
      // qualifying snore events) and must never be reported as one: doing
      // so would fabricate a clean-night result. Persist 'failed' FIRST
      // (same ordering doctrine as the analyzed path below: the terminal row
      // state is durable before any audio is touched), then delete the
      // recording — this audio is provably unanalyzable, so keeping a full
      // night of bedroom sound around on the chance a retry helps would be
      // holding the most sensitive data this app writes for no benefit at
      // all. `keepClips` is false because no clips were ever cut from it.
      const failed = markFailed(session, new Date(session.startedAt));
      await this.deps.store.updateSleepSession(failed);
      await this.tryDeleteRecording(session.id, false);
      return failed;
    }

    const analysis = createSnoreDetector().analyze(frames);
    const durationMs = recordingDurationMs ?? fallbackDurationMs(session);
    const metrics = computeMetrics(analysis.events, durationMs);

    let events = analysis.events;
    if (this.deps.getPreferences()?.keepSnoreClips === true && events.length > 0) {
      const ranked = events
        .map((event, index) => ({ event, index }))
        .sort((a, b) => b.event.confidence - a.event.confidence)
        .slice(0, MAX_CLIPS_PER_NIGHT);

      const ranges: ClipRange[] = ranked.map(({ event, index }) => ({
        id: String(index),
        startMs: Math.max(0, event.startMs - CLIP_PADDING_MS),
        endMs: Math.min(durationMs, event.endMs + CLIP_PADDING_MS),
      }));

      try {
        const cuts = await this.deps.recorder.cutClips(session.id, ranges);
        const pathById = new Map(cuts.map((c) => [c.id, c.path]));
        events = events.map((event, index) => {
          const path = pathById.get(String(index));
          return path !== undefined ? { ...event, clipPath: path } : event;
        });
      } catch {
        // Clip extraction is a bonus, not core analysis — the night's
        // metrics still persist without clips attached. `keepClips` below
        // stays false in that case, which matters: a partially-written clips
        // directory that no row references would otherwise survive
        // `deleteRecording` as unreachable audio nothing can ever delete.
      }
    }

    // `keepClips` is derived from what actually got ATTACHED, never from the
    // preference alone. The preference says the user wants clips; only an
    // attached `clipPath` proves a clip exists AND is referenced by the row
    // that is about to be persisted. Anything else (preference off, cutClips
    // threw, cutClips legitimately produced nothing) must delete the clips
    // directory along with the segments, or it becomes an orphan.
    const keepClips = events.some((event) => event.clipPath !== undefined);

    const analyzed = markAnalyzed(session, { ...analysis, events }, metrics);
    await this.deps.store.updateSleepSession(analyzed);
    await this.tryDeleteRecording(session.id, keepClips);

    return analyzed;
  }

  /**
   * Reconciles stored rows against native truth after a restart:
   * - a pending 'recording' row matching a live native session is adopted
   *   as-is (no write needed) — or, if native is recording but no row
   *   exists for it at all, a fresh row is created and adopted;
   * - a pending 'recording' row matching a session native already knows
   *   stopped is finalized (with the real decodable `durationMs` carried
   *   through from the claimed result — never a wall-clock guess) and analyzed;
   * - each pending 'recorded' row gets a fresh analysis attempt, in
   *   sequence, with failures isolated per session (one bad night never
   *   blocks recovering the rest);
   * - a pending 'recording' row with no native knowledge at all is lost —
   *   marked 'failed' with `endedAt` pinned to `startedAt`.
   *
   * "Pending" here means `state === 'recording' || 'recorded'` — NOT
   * `state !== 'analyzed'` — so 'failed' rows are never resurrected or
   * rewritten on every launch (they already reached a terminal state).
   *
   * Native truth comes ONLY from `getStatus()` here — no speculative
   * `stop()` call. A stopped-but-unclaimed session is only claimed (via
   * `stop()`, to get its authoritative result) once `status.phase ===
   * 'stopped'` has positively confirmed one exists; a rejection at that
   * point is a real error, not "native remembers nothing", so it is
   * isolated to that one session (left untouched, still 'recording', for a
   * later recovery attempt) rather than writing off a real night as lost.
   */
  async recoverOnLaunch(now: Date): Promise<{ live?: SleepSession }> {
    const status = await this.deps.recorder.getStatus();
    const pending = this.deps
      .getSessions()
      .filter((s) => s.state === 'recording' || s.state === 'recorded');

    let nativeStopped: RecorderStopResult | undefined;
    let unclaimedStoppedSessionId: string | undefined;
    if (status.phase === 'stopped' && status.sessionId !== undefined) {
      try {
        nativeStopped = await this.deps.recorder.stop();
      } catch {
        unclaimedStoppedSessionId = status.sessionId;
      }
    }

    // A claim failure is isolated to just that session: exclude it from
    // classification entirely rather than let it fall into `lost` (which
    // would mark a night `getStatus()` just told us genuinely exists as
    // failed, on what may be a transient bridge error).
    const classifiable = unclaimedStoppedSessionId
      ? pending.filter((s) => s.id !== unclaimedStoppedSessionId)
      : pending;

    const classification = classifyPendingSessions(classifiable, status, nativeStopped);
    let live = classification.live;

    if (live === null && status.phase === 'recording' && status.sessionId !== undefined) {
      const sessionId = status.sessionId;
      const adopted = buildSleepSession({
        id: sessionId,
        startedAt: status.startedAtMs !== undefined ? new Date(status.startedAtMs) : now,
        quitAt: this.deps.getQuitAt(),
      });
      await this.deps.store.addSleepSession(adopted);
      live = adopted;
    }

    for (const { session, endedAtMs, durationMs, interrupted } of classification.finalize) {
      const startedAtMs = new Date(session.startedAt).getTime();
      const finalized = finalizeRecorded(session, {
        sessionId: session.id,
        startedAtMs,
        endedAtMs,
        durationMs,
        interrupted,
      });
      await this.deps.store.updateSleepSession(finalized);
      try {
        await this.analyzeSession(finalized, durationMs);
      } catch {
        // Isolated per session: leaves this row 'recorded' for a later retry.
      }
    }

    for (const session of classification.retryAnalysis) {
      try {
        await this.analyzeSession(session);
      } catch {
        // Isolated per session: leaves this row 'recorded' for a later retry.
      }
    }

    for (const session of classification.lost) {
      const failed = markFailed(session, new Date(session.startedAt));
      await this.deps.store.updateSleepSession(failed);
    }

    return live !== null ? { live } : {};
  }

  /**
   * Deletes everything this night has on the device — its clip files, its
   * full-night audio, then the row itself. Both native deletions are
   * best-effort (see `tryDeleteRecording`); only the row removal is required
   * to succeed.
   *
   * `deleteRecording` matters most for exactly the rows the UI can least
   * afford to leave behind: a 'recording'/'recorded' night whose analysis
   * never completed still has its whole overnight recording on disk, and
   * this per-night delete is the only way a user can get rid of it. Clearing
   * only the row would leave that audio unreachable — native's own handle on
   * it is dropped the next time a recording starts — while the UI claims the
   * full recording is always deleted.
   */
  async deleteSession(id: string): Promise<void> {
    const session = this.deps.getSessions().find((s) => s.id === id);
    const clipPaths = clipPathsOf(session ? [session] : []);
    if (clipPaths.length > 0) {
      try {
        await this.deps.recorder.deleteClips(clipPaths);
      } catch {
        // Non-fatal: dangling clip files are harmless; the row is the source of truth.
      }
    }
    // keepClips: false — the user asked for this night to be gone, clips
    // included (the explicit `deleteClips` above only covers paths the row
    // still references).
    await this.tryDeleteRecording(id, false);
    await this.deps.store.removeSleepSession(id);
  }

  /** Same as `deleteSession`, but for every stored night at once. */
  async deleteAllSessions(): Promise<void> {
    const sessions = this.deps.getSessions();
    const clipPaths = clipPathsOf(sessions);
    if (clipPaths.length > 0) {
      try {
        await this.deps.recorder.deleteClips(clipPaths);
      } catch {
        // Non-fatal, see `deleteSession`.
      }
    }
    // Every row, in sequence: at most one of them is the session native
    // currently holds, but which one that is isn't knowable from here, and
    // asking about a night native has moved past costs only a rejection that
    // `tryDeleteRecording` swallows.
    for (const session of sessions) {
      await this.tryDeleteRecording(session.id, false);
    }
    await this.deps.store.clearSleepSessions();
  }
}
