/**
 * The `SleepRecorder` port. Everything else in the app depends ONLY on
 * this module — never on `lib/native/snoreMonitor` (the native plugin
 * contract) or on any adapter directly. Two adapters implement it:
 * `nativeSleepRecorder` (Android, via the Capacitor plugin) and
 * `webSleepRecorder` (dev-only fake-night recorder for a desktop browser).
 */
import type { FeatureFrame } from '@/domain/snore/types';

export interface RecorderStatus {
  recording: boolean;
  sessionId?: string;
  startedAtMs?: number;
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
