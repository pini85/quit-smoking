/**
 * Dev-only "fake-night" `SleepRecorder`. Lets the whole recording -> feature
 * -> detection -> review flow be developed in a desktop browser, without a
 * device or the native Kotlin plugin. Real microphone capture, but the DSP
 * is a lightweight time-domain approximation — it only needs to produce
 * plausible `FeatureFrame` values in the right ranges, not spectral
 * accuracy (see `computeHopFeatures` below).
 *
 * State lives entirely in memory (module-level, one recording at a time).
 * A page reload loses everything, including any "completed" session's
 * frames — this recorder is a development aid, not a persistence layer.
 * `getSleepRecorder()` (lib/recorder/index.ts) only ever wires this in
 * outside production builds.
 */
import type { FeatureFrame } from '@/domain/snore/types';

import type {
  ClipRange,
  CutClip,
  RecorderStatus,
  RecorderStopResult,
  SleepRecorder,
} from '@/lib/recorder/types';

const HOP_SAMPLES = 1024;
const PREFERRED_SAMPLE_RATE = 16000;

const LOW_BAND_HP_HZ = 70;
const LOW_BAND_LP_HZ = 300;
const MID_BAND_HP_HZ = 800;
const MID_BAND_LP_HZ = 3000;
const MIN_RMS_DBFS = -100;

const WORKLET_NAME = 'unsmoke-snore-features';

// ---------------------------------------------------------------------
// Pure DSP helpers. No globals touched, safe to unit-test directly. The
// AudioWorklet path below duplicates this same math as a self-contained
// inline string (a worklet module runs in its own realm and can't import
// this module), but the ScriptProcessorNode fallback calls it directly.
// ---------------------------------------------------------------------

export interface OnePoleLowpassState {
  y: number;
}
export interface OnePoleHighpassState {
  xPrev: number;
  yPrev: number;
}
export interface HopDspState {
  lowHp: OnePoleHighpassState;
  lowLp: OnePoleLowpassState;
  midHp: OnePoleHighpassState;
  midLp: OnePoleLowpassState;
}

export function createHopDspState(): HopDspState {
  return {
    lowHp: { xPrev: 0, yPrev: 0 },
    lowLp: { y: 0 },
    midHp: { xPrev: 0, yPrev: 0 },
    midLp: { y: 0 },
  };
}

function lowpassAlpha(cutoffHz: number, sampleRate: number): number {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  return dt / (rc + dt);
}

function highpassAlpha(cutoffHz: number, sampleRate: number): number {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  return rc / (rc + dt);
}

function runLowpass(samples: Float32Array, alpha: number, state: OnePoleLowpassState): Float32Array {
  const out = new Float32Array(samples.length);
  let y = state.y;
  for (let i = 0; i < samples.length; i++) {
    y += alpha * (samples[i] - y);
    out[i] = y;
  }
  state.y = y;
  return out;
}

function runHighpass(samples: Float32Array, alpha: number, state: OnePoleHighpassState): Float32Array {
  const out = new Float32Array(samples.length);
  let xPrev = state.xPrev;
  let yPrev = state.yPrev;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = alpha * (yPrev + x - xPrev);
    out[i] = y;
    xPrev = x;
    yPrev = y;
  }
  state.xPrev = xPrev;
  state.yPrev = yPrev;
  return out;
}

function sumSquares(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return sum;
}

/**
 * One hop (1024 samples) -> `{ rmsDbfs, lowBandRatio, midBandRatio }`, via
 * cascaded one-pole high/low-pass filters approximating the 70-300Hz and
 * 800-3000Hz bands. `state` carries filter memory across hops and is
 * mutated in place (continuity across hop boundaries).
 */
export function computeHopFeatures(
  samples: Float32Array,
  sampleRate: number,
  state: HopDspState
): { rmsDbfs: number; lowBandRatio: number; midBandRatio: number } {
  const totalEnergy = sumSquares(samples);

  const lowHpOut = runHighpass(samples, highpassAlpha(LOW_BAND_HP_HZ, sampleRate), state.lowHp);
  const lowBandOut = runLowpass(lowHpOut, lowpassAlpha(LOW_BAND_LP_HZ, sampleRate), state.lowLp);
  const lowEnergy = sumSquares(lowBandOut);

  const midHpOut = runHighpass(samples, highpassAlpha(MID_BAND_HP_HZ, sampleRate), state.midHp);
  const midBandOut = runLowpass(midHpOut, lowpassAlpha(MID_BAND_LP_HZ, sampleRate), state.midLp);
  const midEnergy = sumSquares(midBandOut);

  const meanSquare = totalEnergy / samples.length;
  const rmsDbfs = meanSquare > 0 ? Math.max(MIN_RMS_DBFS, 10 * Math.log10(meanSquare)) : MIN_RMS_DBFS;
  const lowBandRatio = totalEnergy > 0 ? Math.min(1, lowEnergy / totalEnergy) : 0;
  const midBandRatio = totalEnergy > 0 ? Math.min(1, midEnergy / totalEnergy) : 0;

  return { rmsDbfs, lowBandRatio, midBandRatio };
}

// ---------------------------------------------------------------------
// AudioWorklet module source (self-contained; loaded via a Blob URL since
// there is no on-disk worklet file in a static-export app). Duplicates the
// same time-domain math as the pure helpers above — a worklet runs in a
// separate global scope and can't `import` this module.
// ---------------------------------------------------------------------

function createWorkletModuleSource(): string {
  return `
    class UnsmokeSnoreFeaturesProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.hopSize = ${HOP_SAMPLES};
        this.buffer = new Float32Array(this.hopSize);
        this.bufferFill = 0;
        this.hopIndex = 0;
        this.lowHpXPrev = 0; this.lowHpYPrev = 0; this.lowLpY = 0;
        this.midHpXPrev = 0; this.midHpYPrev = 0; this.midLpY = 0;
      }

      _alpha(cutoffHz, isHighpass) {
        const rc = 1 / (2 * Math.PI * cutoffHz);
        const dt = 1 / sampleRate;
        return isHighpass ? rc / (rc + dt) : dt / (rc + dt);
      }

      _processHop(hop) {
        const n = hop.length;
        const lowHpAlpha = this._alpha(${LOW_BAND_HP_HZ}, true);
        const lowLpAlpha = this._alpha(${LOW_BAND_LP_HZ}, false);
        const midHpAlpha = this._alpha(${MID_BAND_HP_HZ}, true);
        const midLpAlpha = this._alpha(${MID_BAND_LP_HZ}, false);
        let lowHpXPrev = this.lowHpXPrev, lowHpYPrev = this.lowHpYPrev, lowLpY = this.lowLpY;
        let midHpXPrev = this.midHpXPrev, midHpYPrev = this.midHpYPrev, midLpY = this.midLpY;
        let total = 0, lowEnergy = 0, midEnergy = 0;
        for (let i = 0; i < n; i++) {
          const x = hop[i];
          total += x * x;

          const lowHpY = lowHpAlpha * (lowHpYPrev + x - lowHpXPrev);
          lowHpXPrev = x; lowHpYPrev = lowHpY;
          lowLpY += lowLpAlpha * (lowHpY - lowLpY);
          lowEnergy += lowLpY * lowLpY;

          const midHpY = midHpAlpha * (midHpYPrev + x - midHpXPrev);
          midHpXPrev = x; midHpYPrev = midHpY;
          midLpY += midLpAlpha * (midHpY - midLpY);
          midEnergy += midLpY * midLpY;
        }
        this.lowHpXPrev = lowHpXPrev; this.lowHpYPrev = lowHpYPrev; this.lowLpY = lowLpY;
        this.midHpXPrev = midHpXPrev; this.midHpYPrev = midHpYPrev; this.midLpY = midLpY;

        const meanSquare = total / n;
        const rmsDbfs = meanSquare > 0 ? Math.max(${MIN_RMS_DBFS}, 10 * Math.log10(meanSquare)) : ${MIN_RMS_DBFS};
        const lowBandRatio = total > 0 ? Math.min(1, lowEnergy / total) : 0;
        const midBandRatio = total > 0 ? Math.min(1, midEnergy / total) : 0;

        const tMs = Math.round(((this.hopIndex * this.hopSize) / sampleRate) * 1000);
        this.hopIndex += 1;
        this.port.postMessage({ tMs, rmsDbfs, lowBandRatio, midBandRatio });
      }

      process(inputs) {
        const input = inputs[0];
        const channel = input && input[0];
        if (!channel) return true;
        let offset = 0;
        while (offset < channel.length) {
          const need = this.hopSize - this.bufferFill;
          const take = Math.min(need, channel.length - offset);
          this.buffer.set(channel.subarray(offset, offset + take), this.bufferFill);
          this.bufferFill += take;
          offset += take;
          if (this.bufferFill === this.hopSize) {
            this._processHop(this.buffer);
            this.bufferFill = 0;
          }
        }
        return true;
      }
    }
    registerProcessor('${WORKLET_NAME}', UnsmokeSnoreFeaturesProcessor);
  `;
}

interface WorkletFrameMessage {
  tMs: number;
  rmsDbfs: number;
  lowBandRatio: number;
  midBandRatio: number;
}

interface WebRecorderSession {
  sessionId: string;
  startedAtMs: number;
  stream: MediaStream;
  audioContext: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  workletNode?: AudioWorkletNode;
  scriptNode?: ScriptProcessorNode;
  sampleRate: number;
  frames: FeatureFrame[];
  // Only used by the ScriptProcessorNode fallback (the AudioWorklet path
  // keeps its own copy of this state inside the worklet's own realm).
  fallbackDspState: HopDspState;
  fallbackHopIndex: number;
}

let current: WebRecorderSession | null = null;
// Frames from completed sessions stay available (in memory, for this page
// life only) so `getFeatures` still works after `stop()` clears `current`.
const sessionFrames = new Map<string, FeatureFrame[]>();

function attachScriptProcessorFallback(
  audioContext: AudioContext,
  sourceNode: MediaStreamAudioSourceNode,
  session: WebRecorderSession
): void {
  const bufferSize = 4096;
  const scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
  let pending = new Float32Array(0);

  scriptNode.onaudioprocess = (event: AudioProcessingEvent) => {
    const input = event.inputBuffer.getChannelData(0);
    const combined = new Float32Array(pending.length + input.length);
    combined.set(pending, 0);
    combined.set(input, pending.length);

    let offset = 0;
    while (combined.length - offset >= HOP_SAMPLES) {
      const hop = combined.subarray(offset, offset + HOP_SAMPLES);
      const features = computeHopFeatures(hop, session.sampleRate, session.fallbackDspState);
      const tMs = Math.round(((session.fallbackHopIndex * HOP_SAMPLES) / session.sampleRate) * 1000);
      session.fallbackHopIndex += 1;
      session.frames.push({ tMs, ...features });
      offset += HOP_SAMPLES;
    }
    pending = combined.slice(offset);
  };

  sourceNode.connect(scriptNode);
  // ScriptProcessorNode only fires onaudioprocess while connected into a
  // live graph; we never write to outputBuffer, so this is silent.
  scriptNode.connect(audioContext.destination);
  session.scriptNode = scriptNode;
}

async function attachAudioWorklet(
  audioContext: AudioContext,
  sourceNode: MediaStreamAudioSourceNode,
  session: WebRecorderSession
): Promise<void> {
  const moduleUrl = URL.createObjectURL(
    new Blob([createWorkletModuleSource()], { type: 'application/javascript' })
  );
  try {
    await audioContext.audioWorklet.addModule(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }

  // numberOfOutputs: 0 — this node is a pure analysis sink, nothing to play
  // back. Per the Web Audio spec a node with an active input connection
  // keeps processing as long as process() returns true, whether or not it
  // has outputs or is itself connected onward.
  const workletNode = new AudioWorkletNode(audioContext, WORKLET_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
  });
  workletNode.port.onmessage = (event: MessageEvent<WorkletFrameMessage>) => {
    session.frames.push(event.data);
  };
  sourceNode.connect(workletNode);
  session.workletNode = workletNode;
}

async function start(
  sessionId: string
): Promise<{ sessionId: string; startedAtMs: number; alreadyRunning: boolean }> {
  if (current) {
    return { sessionId: current.sessionId, startedAtMs: current.startedAtMs, alreadyRunning: true };
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  let audioContext: AudioContext;
  try {
    audioContext = new AudioContext({ sampleRate: PREFERRED_SAMPLE_RATE });
  } catch {
    audioContext = new AudioContext();
  }
  const sampleRate = audioContext.sampleRate;
  if (sampleRate !== PREFERRED_SAMPLE_RATE) {
    console.info(
      `Unsmoke (web-dev recorder): AudioContext sample rate is ${sampleRate}Hz, not the preferred ${PREFERRED_SAMPLE_RATE}Hz — features are computed at the actual rate.`
    );
  }

  const sourceNode = audioContext.createMediaStreamSource(stream);
  const startedAtMs = Date.now();
  const frames: FeatureFrame[] = [];
  sessionFrames.set(sessionId, frames);

  const session: WebRecorderSession = {
    sessionId,
    startedAtMs,
    stream,
    audioContext,
    sourceNode,
    sampleRate,
    frames,
    fallbackDspState: createHopDspState(),
    fallbackHopIndex: 0,
  };

  const supportsWorklet = typeof AudioWorkletNode !== 'undefined' && !!audioContext.audioWorklet;
  if (supportsWorklet) {
    try {
      await attachAudioWorklet(audioContext, sourceNode, session);
    } catch (error) {
      console.warn(
        'Unsmoke (web-dev recorder): AudioWorklet setup failed, falling back to ScriptProcessorNode',
        error
      );
      attachScriptProcessorFallback(audioContext, sourceNode, session);
    }
  } else {
    attachScriptProcessorFallback(audioContext, sourceNode, session);
  }

  current = session;
  return { sessionId, startedAtMs, alreadyRunning: false };
}

async function stop(): Promise<RecorderStopResult> {
  if (!current) {
    throw new Error('Unsmoke (web-dev recorder): stop() called with no active recording.');
  }
  const session = current;
  const endedAtMs = Date.now();

  session.workletNode?.disconnect();
  session.scriptNode?.disconnect();
  session.sourceNode.disconnect();
  for (const track of session.stream.getTracks()) track.stop();
  await session.audioContext.close();

  current = null;

  return {
    sessionId: session.sessionId,
    startedAtMs: session.startedAtMs,
    endedAtMs,
    durationMs: endedAtMs - session.startedAtMs,
    interrupted: false,
  };
}

async function getStatus(): Promise<RecorderStatus> {
  if (!current) return { recording: false };
  return { recording: true, sessionId: current.sessionId, startedAtMs: current.startedAtMs };
}

async function getFeatures(sessionId: string): Promise<FeatureFrame[]> {
  return sessionFrames.get(sessionId) ?? [];
}

async function cutClips(_sessionId: string, _clips: ClipRange[]): Promise<CutClip[]> {
  // The web-dev recorder never wrote clip files — nothing to cut from.
  return [];
}

function getClipUrl(_path: string): string | null {
  return null;
}

async function deleteRecording(_sessionId: string, _keepClips: boolean): Promise<void> {
  // No persisted audio to delete — in-memory only, gone on page reload.
}

async function deleteClips(_paths: string[]): Promise<void> {
  // No persisted clip files exist for the web-dev recorder.
}

async function permissions(): Promise<'granted' | 'denied' | 'prompt'> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'prompt';
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state;
  } catch {
    return 'prompt';
  }
}

async function requestPermissions(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return 'granted';
  } catch {
    return 'denied';
  }
}

export const webSleepRecorder: SleepRecorder = {
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

export default webSleepRecorder;
