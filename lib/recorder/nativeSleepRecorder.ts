/**
 * `SleepRecorder` adapter over the native Capacitor plugin
 * (`lib/native/snoreMonitor`). Straight mapping from the plugin's wire
 * shapes to the port's shapes — no state of its own; the native side
 * (Kotlin) owns all session state.
 */
import { Capacitor } from '@capacitor/core';

import { parseFeaturesFile } from '@/domain/snore/featuresFile';
import type { FeatureFrame } from '@/domain/snore/types';

import { SnoreMonitor } from '@/lib/native/snoreMonitor';
import type {
  ClipRange,
  CutClip,
  RecorderPermissions,
  RecorderStatus,
  RecorderStopResult,
  SleepRecorder,
} from '@/lib/recorder/types';

// Both permission calls pass `microphone` AND `notifications` straight
// through: the plugin already normalizes its side to exactly the port's
// three-value union (see `SnoreMonitorPlugin.checkPermissions`, which
// collapses Capacitor's fourth PROMPT_WITH_RATIONALE value and reports
// 'granted' for notifications below API 33), so there is nothing left to
// translate here.
async function permissions(): Promise<RecorderPermissions> {
  const result = await SnoreMonitor.checkPermissions();
  return { microphone: result.microphone, notifications: result.notifications };
}

async function requestPermissions(): Promise<RecorderPermissions> {
  const result = await SnoreMonitor.requestPermissions();
  return { microphone: result.microphone, notifications: result.notifications };
}

async function start(
  sessionId: string
): Promise<{ sessionId: string; startedAtMs: number; alreadyRunning: boolean }> {
  const result = await SnoreMonitor.startRecording({ sessionId });
  return {
    sessionId: result.sessionId,
    startedAtMs: result.startedAt,
    alreadyRunning: result.alreadyRunning,
  };
}

async function stop(): Promise<RecorderStopResult> {
  const result = await SnoreMonitor.stopRecording();
  return {
    sessionId: result.sessionId,
    startedAtMs: result.startedAt,
    endedAtMs: result.endedAt,
    durationMs: result.durationMs,
    interrupted: result.interrupted,
  };
}

async function getStatus(): Promise<RecorderStatus> {
  const status = await SnoreMonitor.getStatus();
  return {
    phase: status.phase,
    sessionId: status.sessionId,
    startedAtMs: status.startedAt,
    endedAtMs: status.endedAt,
    interrupted: status.interrupted,
  };
}

async function getFeatures(sessionId: string): Promise<FeatureFrame[]> {
  const { featuresPath } = await SnoreMonitor.extractFeatures({ sessionId });
  const response = await fetch(Capacitor.convertFileSrc(featuresPath));
  const buf = await response.arrayBuffer();
  return parseFeaturesFile(buf).frames;
}

async function cutClips(sessionId: string, clips: ClipRange[]): Promise<CutClip[]> {
  const result = await SnoreMonitor.cutClips({ sessionId, clips });
  return result.clips.map((clip) => ({ id: clip.id, path: clip.path }));
}

async function deleteRecording(sessionId: string, keepClips: boolean): Promise<void> {
  await SnoreMonitor.deleteSessionAudio({ sessionId, keepClips });
}

function getClipUrl(path: string): string | null {
  return Capacitor.convertFileSrc(path);
}

async function deleteClips(paths: string[]): Promise<void> {
  await SnoreMonitor.deleteClips({ paths });
}

export const nativeSleepRecorder: SleepRecorder = {
  permissions,
  requestPermissions,
  start,
  stop,
  getStatus,
  getFeatures,
  cutClips,
  deleteRecording,
  getClipUrl,
  deleteClips,
};

export default nativeSleepRecorder;
