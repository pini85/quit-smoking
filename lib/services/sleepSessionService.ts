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
import type { SleepRecorder, ClipRange } from '@/lib/recorder/types';
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
   * If native is already recording (e.g. a previous `startMonitoring` call,
   * or an in-progress night from before this service instance existed),
   * adopts that session instead of starting a second one — a double-start
   * is a no-op that returns the existing row. Otherwise starts a fresh
   * native recording and persists its row. A native start failure
   * propagates (rethrown) with no row written.
   */
  async startMonitoring(now: Date): Promise<SleepSession> {
    const status = await this.deps.recorder.getStatus();
    if (status.recording && status.sessionId !== undefined) {
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
   * Double-stop is a no-op: if native reports it isn't recording, there is
   * nothing to stop (any prior row has already moved past 'recording' by
   * the time a first `stopMonitoring` call finishes), so this returns
   * `null` without touching the recorder or any row.
   */
  async stopMonitoring(now: Date): Promise<SleepSession | null> {
    // `now` is accepted (unused) for symmetry with the other explicit-`now`
    // methods — every timestamp this method needs comes from the recorder's
    // own `stop()` result, which is authoritative.
    void now;

    const status = await this.deps.recorder.getStatus();
    if (!status.recording) return null;

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
   * stored as 'analyzed' — see `markAnalyzed`'s doc. `markFailed` is
   * reserved for truly unanalyzable sessions: no feature frames at all, or
   * native reporting `SESSION_NOT_FOUND`.
   *
   * Ordering is safety-critical: the 'analyzed' row (with its metrics) is
   * persisted BEFORE `deleteRecording` is ever called, so a crash or thrown
   * error between the two leaves the audio intact rather than losing a
   * night's data. Any error thrown before that persist (e.g. detector
   * failure) propagates and leaves the row in 'recorded' — the UI can
   * offer a retry, which calls this method again over the same audio.
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
        // metrics still persist without clips attached.
      }
    }

    const analyzed = markAnalyzed(session, { ...analysis, events }, metrics);
    await this.deps.store.updateSleepSession(analyzed);

    try {
      await this.deps.recorder.deleteRecording(session.id, this.deps.getPreferences()?.keepSnoreClips === true);
    } catch {
      // Non-fatal by design: the analyzed row above is already the
      // authoritative record of this night. Leftover audio on-device is
      // harmless and a future recovery/maintenance pass can retry deletion.
    }

    return analyzed;
  }

  /**
   * Reconciles stored rows against native truth after a restart:
   * - a pending 'recording' row matching a live native session is adopted
   *   as-is (no write needed) — or, if native is recording but no row
   *   exists for it at all, a fresh row is created and adopted;
   * - a pending 'recording' row matching a session native already knows
   *   stopped is finalized and analyzed;
   * - each pending 'recorded' row gets a fresh analysis attempt, in
   *   sequence, with failures isolated per session (one bad night never
   *   blocks recovering the rest);
   * - a pending 'recording' row with no native knowledge at all is lost —
   *   marked 'failed' with `endedAt` pinned to `startedAt`.
   */
  async recoverOnLaunch(now: Date): Promise<{ live?: SleepSession }> {
    const status = await this.deps.recorder.getStatus();
    const pending = this.deps.getSessions().filter((s) => s.state !== 'analyzed');

    let nativeStopped: { sessionId?: string; endedAtMs?: number; interrupted?: boolean } | undefined;
    if (!status.recording) {
      try {
        nativeStopped = await this.deps.recorder.stop();
      } catch {
        // Nothing native remembers stopping — every unmatched 'recording' row is lost, below.
        nativeStopped = undefined;
      }
    }

    const classification = classifyPendingSessions(pending, status, nativeStopped);
    let live = classification.live;

    if (live === null && status.recording && status.sessionId !== undefined) {
      const sessionId = status.sessionId;
      const adopted = buildSleepSession({
        id: sessionId,
        startedAt: status.startedAtMs !== undefined ? new Date(status.startedAtMs) : now,
        quitAt: this.deps.getQuitAt(),
      });
      await this.deps.store.addSleepSession(adopted);
      live = adopted;
    }

    for (const { session, endedAtMs, interrupted } of classification.finalize) {
      const startedAtMs = new Date(session.startedAt).getTime();
      const durationMs = Math.max(0, endedAtMs - startedAtMs);
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

  /** Deletes any clip files the row references (non-fatal on error), then the row itself. */
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
    await this.deps.store.removeSleepSession(id);
  }

  /** Same as `deleteSession`, but for every stored night at once. */
  async deleteAllSessions(): Promise<void> {
    const clipPaths = clipPathsOf(this.deps.getSessions());
    if (clipPaths.length > 0) {
      try {
        await this.deps.recorder.deleteClips(clipPaths);
      } catch {
        // Non-fatal, see `deleteSession`.
      }
    }
    await this.deps.store.clearSleepSessions();
  }
}
