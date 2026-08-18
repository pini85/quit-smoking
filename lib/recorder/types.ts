/**
 * The `SleepRecorder` port. Everything else in the app depends ONLY on
 * this module — never on `lib/native/snoreMonitor` (the native plugin
 * contract) or on any adapter directly. Two adapters implement it:
 * `nativeSleepRecorder` (Android, via the Capacitor plugin) and
 * `webSleepRecorder` (dev-only fake-night recorder for a desktop browser).
 */
import type { FeatureFrame } from '@/domain/snore/types';

/** Mirrors the native plugin's `SessionPhase` (`lib/native/snoreMonitor.ts`) 1:1. */
export type RecorderPhase = 'idle' | 'recording' | 'stopped';

/** Mirrors the native plugin's `PermissionState` (`lib/native/snoreMonitor.ts`) 1:1. */
export type RecorderPermissionState = 'granted' | 'denied' | 'prompt';

/**
 * Both permissions overnight monitoring involves.
 *
 * `microphone` is the hard gate: without it there is no recording. `notifications`
 * is NOT a gate — Android runs the foreground service, and therefore the
 * recording, whether or not the user allowed its notification to be shown; all
 * a denial changes is that the ongoing-recording notification (and its Stop
 * action) stays hidden.
 *
 * The native plugin has always answered both. The port used to drop
 * `notifications` on the floor and return the microphone state alone, which
 * left the UI promising a persistent notification the user could never see.
 * Surfacing both is what lets `PreSleepCard` say so honestly instead.
 */
export interface RecorderPermissions {
  microphone: RecorderPermissionState;
  notifications: RecorderPermissionState;
}

export interface RecorderStatus {
  phase: RecorderPhase;
  sessionId?: string;
  startedAtMs?: number;
  /**
   * Present only when `phase === 'stopped'` — native remembers a session it
   * already stopped but that hasn't been claimed (finalized) yet. Purely
   * informational: native's `getStatus()` never carries the real decodable
   * `durationMs` (only `stopRecording()`'s result does, per its own doc in
   * `lib/native/snoreMonitor.ts`), so claiming the session's authoritative
   * result — including that `durationMs` — still requires calling `stop()`.
   */
  endedAtMs?: number;
  interrupted?: boolean;
}

export interface RecorderStopResult {
  sessionId: string;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  interrupted: boolean;
}

export interface ClipRange {
  id: string;
  startMs: number;
  endMs: number;
}

export interface CutClip {
  id: string;
  path: string;
}

export interface SleepRecorder {
  /** Current state of both permissions, without prompting for either. */
  permissions(): Promise<RecorderPermissions>;
  /** Prompts for whichever of the two is still promptable, then reports both. */
  requestPermissions(): Promise<RecorderPermissions>;
  start(sessionId: string): Promise<{ sessionId: string; startedAtMs: number; alreadyRunning: boolean }>;
  stop(): Promise<RecorderStopResult>;
  getStatus(): Promise<RecorderStatus>;
  getFeatures(sessionId: string): Promise<FeatureFrame[]>;
  cutClips(sessionId: string, clips: ClipRange[]): Promise<CutClip[]>;
  deleteRecording(sessionId: string, keepClips: boolean): Promise<void>;
  getClipUrl(path: string): string | null;
  deleteClips(paths: string[]): Promise<void>;
}

export type RecorderAvailability = 'native' | 'web-dev' | 'unavailable';
