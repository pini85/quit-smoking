/**
 * Capacitor plugin binding for the native (Kotlin) overnight audio
 * recorder. The Kotlin plugin does NOT exist yet — this file IS the frozen
 * contract it must implement; a later task reads this file as its spec.
 * Do not change these shapes without updating the native side to match.
 *
 * Error codes the native implementation rejects with (by plugin call):
 *  - PERMISSION_DENIED   startRecording — microphone permission not granted
 *  - NOT_RECORDING       stopRecording / extractFeatures — no active/last
 *                        session to act on
 *  - ALREADY_PROCESSING  extractFeatures / cutClips — a previous extraction
 *                        or cut is still running for this session
 *  - LOW_STORAGE         startRecording — insufficient device storage to
 *                        begin a new recording
 *  - SESSION_NOT_FOUND   extractFeatures / cutClips / deleteSessionAudio —
 *                        sessionId does not match any known recording
 *  - EXTRACTION_FAILED   extractFeatures — feature extraction could not
 *                        produce a valid features.bin
 */
import { registerPlugin } from '@capacitor/core';

export type SessionPhase = 'idle' | 'recording' | 'stopped';
export type StopReason = 'user' | 'notification' | 'error' | 'low-storage';
export type PermissionState = 'granted' | 'denied' | 'prompt';

export interface RecordingStatus {
  phase: SessionPhase;
  sessionId?: string;
  startedAt?: number; // epoch ms
  elapsedMs?: number;
  endedAt?: number; // stopped only
  interrupted?: boolean; // stopped only
  stopReason?: StopReason; // stopped only
}

export interface StopResult {
  sessionId: string;
  startedAt: number;
  endedAt: number;
  durationMs: number; // decodable audio duration (< endedAt-startedAt if interrupted)
  interrupted: boolean;
  stopReason: StopReason;
  segmentCount: number;
}

export interface SnoreMonitorPlugin {
  checkPermissions(): Promise<{ microphone: PermissionState; notifications: PermissionState }>;
  requestPermissions(): Promise<{ microphone: PermissionState; notifications: PermissionState }>;
  startRecording(options: {
    sessionId: string;
  }): Promise<{ sessionId: string; startedAt: number; alreadyRunning: boolean }>;
  stopRecording(): Promise<StopResult>;
  getStatus(): Promise<RecordingStatus>;
  extractFeatures(options: {
    sessionId: string;
  }): Promise<{ featuresPath: string; frameCount: number; hopMs: number; sampleRate: number }>;
  cutClips(options: {
    sessionId: string;
    clips: { id: string; startMs: number; endMs: number }[];
  }): Promise<{ clips: { id: string; path: string; durationMs: number }[] }>;
  deleteSessionAudio(options: { sessionId: string; keepClips?: boolean }): Promise<void>;
  deleteClips(options: { paths: string[] }): Promise<void>;
}

export const SnoreMonitor = registerPlugin<SnoreMonitorPlugin>('SnoreMonitor');
