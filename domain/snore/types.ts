/**
 * Pure types for snore detection. Like `domain/types.ts`, this module must
 * stay free of React, Dexie, `window`, and wall-clock access — everything
 * here operates on already-extracted feature frames, never on audio or the
 * real clock.
 */

// SnoreEvent lives in `domain/types.ts` (it is a stored/exported shape, like
// SleepSession) — imported (and re-exported below) so detector code can
// `import type` from a single local module.
import type { SnoreEvent } from '@/domain/types';

export interface FeatureFrame {
  tMs: number; // offset from recording start
  rmsDbfs: number; // <= 0
  lowBandRatio: number; // energy share 70-300 Hz, 0..1 (snore fundamental band)
  midBandRatio: number; // energy share 800-3000 Hz, 0..1 (speech/TV discriminator)
}

export interface SnoreAnalysis {
  events: SnoreEvent[];
  noiseFloorDbfs: number; // representative floor for diagnostics/tests (e.g. median of per-frame floors)
  analysisVersion: string;
}

/** Detection thresholds — every field overridable for tests; defaults live in `constants.ts`. */
export interface DetectorOptions {
  noiseFloorWindowMs: number;
  noiseFloorPercentile: number;
  candidateDeltaDb: number;
  minLowBandRatio: number;
  maxMidBandRatio: number;
  burstGapToleranceMs: number;
  minBurstMs: number;
  maxBurstMs: number;
  minRunBursts: number;
  minBreathIntervalMs: number;
  maxBreathIntervalMs: number;
  maxIntervalCv: number;
  eventMergeGapMs: number;
  minEventConfidence: number;
}

export interface SnoreDetector {
  analyze(frames: FeatureFrame[], opts?: Partial<DetectorOptions>): SnoreAnalysis;
}

export type { SnoreEvent };
