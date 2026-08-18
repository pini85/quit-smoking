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
  /** Microphone permission only — notifications are handled natively/best-effort. */
  permissions(): Promise<'granted' | 'denied' | 'prompt'>;
  requestPermissions(): Promise<'granted' | 'denied' | 'prompt'>;
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
