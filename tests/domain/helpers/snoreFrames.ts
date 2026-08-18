/**
 * Synthetic FeatureFrame builders for detector tests. Generates a baseline
 * ("silence") signal at a steady (or drifting, via a function baseline) floor
 * and injects bursts on top of it, so tests can construct exact, hand-checkable
 * scenarios without touching real audio or the binary parser.
 */
import type { FeatureFrame } from '@/domain/snore/types';

export interface SilenceSpec {
  dbfs: number;
  lowBandRatio: number;
  midBandRatio: number;
}

export interface BurstSpec {
  startMs: number;
  durationMs: number; // candidate frames span [startMs, startMs + durationMs)
  dbfs: number;
  lowBandRatio: number;
  midBandRatio: number;
}

export interface MakeFramesSpec {
  hopMs: number;
  totalMs: number; // frames generated for tMs in [0, totalMs), stepping by hopMs
  silence: SilenceSpec | ((tMs: number) => SilenceSpec);
  bursts?: BurstSpec[];
}

export function makeFrames(spec: MakeFramesSpec): FeatureFrame[] {
  const bursts = spec.bursts ?? [];
  const frames: FeatureFrame[] = [];
  for (let t = 0; t < spec.totalMs; t += spec.hopMs) {
    const baseline = typeof spec.silence === 'function' ? spec.silence(t) : spec.silence;
    const active = bursts.find((b) => t >= b.startMs && t < b.startMs + b.durationMs);
    const source = active ?? baseline;
    frames.push({
      tMs: t,
      rmsDbfs: source.dbfs,
      lowBandRatio: source.lowBandRatio,
      midBandRatio: source.midBandRatio,
    });
  }
  return frames;
}
