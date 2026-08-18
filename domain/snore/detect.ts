/**
 * Rhythmic-snore detector: a single O(n) pass over feature frames (adaptive
 * noise floor + candidate flagging) followed by O(bursts) grouping (burst
 * formation, rhythmicity filtering, event merging, confidence scoring).
 *
 * Frames may arrive at any hop — time is always derived from `FeatureFrame.tMs`,
 * never a hardcoded constant. See the brief / `constants.ts` for the exact
 * spec values used below.
 */

import type { FeatureFrame, SnoreAnalysis, DetectorOptions, SnoreDetector } from '@/domain/snore/types';
import type { SnoreEvent } from '@/domain/types';
import {
  ANALYSIS_VERSION,
  NOISE_FLOOR_WINDOW_MS,
  NOISE_FLOOR_PERCENTILE,
  CANDIDATE_DELTA_DB,
  MIN_LOW_BAND_RATIO,
  MAX_MID_BAND_RATIO,
  BURST_GAP_TOLERANCE_MS,
  MIN_BURST_MS,
  MAX_BURST_MS,
  MIN_RUN_BURSTS,
  MIN_BREATH_INTERVAL_MS,
  MAX_BREATH_INTERVAL_MS,
  MAX_INTERVAL_CV,
  EVENT_MERGE_GAP_MS,
  MIN_EVENT_CONFIDENCE,
} from '@/domain/snore/constants';
import { clamp01, mean, median, populationStdDev, round2 } from '@/domain/snore/math';

const DEFAULT_OPTIONS: DetectorOptions = {
  noiseFloorWindowMs: NOISE_FLOOR_WINDOW_MS,
  noiseFloorPercentile: NOISE_FLOOR_PERCENTILE,
  candidateDeltaDb: CANDIDATE_DELTA_DB,
  minLowBandRatio: MIN_LOW_BAND_RATIO,
  maxMidBandRatio: MAX_MID_BAND_RATIO,
  burstGapToleranceMs: BURST_GAP_TOLERANCE_MS,
  minBurstMs: MIN_BURST_MS,
  maxBurstMs: MAX_BURST_MS,
  minRunBursts: MIN_RUN_BURSTS,
  minBreathIntervalMs: MIN_BREATH_INTERVAL_MS,
  maxBreathIntervalMs: MAX_BREATH_INTERVAL_MS,
  maxIntervalCv: MAX_INTERVAL_CV,
  eventMergeGapMs: EVENT_MERGE_GAP_MS,
  minEventConfidence: MIN_EVENT_CONFIDENCE,
};

// --- Adaptive noise floor: sliding 1dB-bin histogram over a trailing window ---

const BIN_MIN_DBFS = -96;
const BIN_COUNT = 97; // 1dB bins covering [-96, 0]

function binIndexFor(dbfs: number): number {
  const clamped = Math.min(0, Math.max(BIN_MIN_DBFS, dbfs));
  return Math.floor(clamped) - BIN_MIN_DBFS;
}

function dbfsForBin(bin: number): number {
  return bin + BIN_MIN_DBFS;
}

/**
 * O(1) amortized per frame: adds the entering frame's bin, evicts bins that
 * have fallen out of the trailing window, then walks the (<=97) bins to find
 * the requested percentile.
 */
class NoiseFloorTracker {
  private readonly counts = new Array(BIN_COUNT).fill(0) as number[];
  private total = 0;
  private readonly queue: { tMs: number; bin: number }[] = [];

  constructor(
    private readonly windowMs: number,
    private readonly percentile: number
  ) {}

  /** Adds the frame, evicts stale entries, and returns the floor (dBFS) that INCLUDES this frame. */
  push(tMs: number, dbfs: number): number {
    const bin = binIndexFor(dbfs);
    this.queue.push({ tMs, bin });
    this.counts[bin]++;
    this.total++;

    const cutoff = tMs - this.windowMs;
    while (this.queue.length > 0 && this.queue[0].tMs <= cutoff) {
      const evicted = this.queue.shift() as { tMs: number; bin: number };
      this.counts[evicted.bin]--;
      this.total--;
    }

    const targetIndex = Math.min(this.total - 1, Math.floor(this.percentile * this.total));
    let cumulative = 0;
    for (let bin2 = 0; bin2 < BIN_COUNT; bin2++) {
      cumulative += this.counts[bin2];
      if (cumulative > targetIndex) return dbfsForBin(bin2);
    }
    return 0; // unreachable while total > 0
  }
}

interface Burst {
  startMs: number;
  endMs: number; // exclusive
  frameIndices: number[]; // indices into the input `frames` array of the CANDIDATE frames only
}

function inRange(x: number, min: number, max: number): boolean {
  return x >= min && x <= max;
}

export function createSnoreDetector(): SnoreDetector {
  return {
    analyze(frames: FeatureFrame[], opts?: Partial<DetectorOptions>): SnoreAnalysis {
      const o: DetectorOptions = { ...DEFAULT_OPTIONS, ...opts };

      if (frames.length === 0) {
        return { events: [], noiseFloorDbfs: 0, analysisVersion: ANALYSIS_VERSION };
      }

      // --- Pass 1: adaptive floor + candidate flag, O(n) ---
      const tracker = new NoiseFloorTracker(o.noiseFloorWindowMs, o.noiseFloorPercentile);
      const floors: number[] = new Array(frames.length);
      const isCandidate: boolean[] = new Array(frames.length);
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        const floor = tracker.push(f.tMs, f.rmsDbfs);
        floors[i] = floor;
        isCandidate[i] =
          f.rmsDbfs >= floor + o.candidateDeltaDb &&
          f.lowBandRatio >= o.minLowBandRatio &&
          f.midBandRatio <= o.maxMidBandRatio;
      }

      // Representative frame spacing, DERIVED from the data (never a hardcoded
      // hop) — used to turn point-in-time candidate frames into inclusive/
      // exclusive burst/event spans (each frame covers [tMs, tMs + step)).
      const frameStepMs =
        frames.length >= 2 ? (frames[frames.length - 1].tMs - frames[0].tMs) / (frames.length - 1) : 0;

      // --- Pass 2: bursts — contiguous candidate runs, gap-bridged ---
      const bursts: Burst[] = [];
      let current: Burst | null = null;
      for (let i = 0; i < frames.length; i++) {
        if (!isCandidate[i]) continue;
        const tMs = frames[i].tMs;
        if (current === null) {
          current = { startMs: tMs, endMs: tMs + frameStepMs, frameIndices: [i] };
          continue;
        }
        const gap = tMs - current.endMs;
        if (gap <= o.burstGapToleranceMs) {
          current.endMs = tMs + frameStepMs;
          current.frameIndices.push(i);
        } else {
          bursts.push(current);
          current = { startMs: tMs, endMs: tMs + frameStepMs, frameIndices: [i] };
        }
      }
      if (current !== null) bursts.push(current);

      const sizedBursts = bursts.filter((b) => {
        const duration = b.endMs - b.startMs;
        return duration >= o.minBurstMs && duration <= o.maxBurstMs;
      });

      // --- Rhythmicity: maximal chains of onset-to-onset intervals in range;
      // the WHOLE chain passes (length >= minRunBursts AND cv <= maxIntervalCv)
      // or the whole chain is dropped. ---
      const qualifyingBursts: Burst[] = [];
      let chainStart = 0;
      for (let i = 1; i <= sizedBursts.length; i++) {
        const atEnd = i === sizedBursts.length;
        const interval = atEnd ? null : sizedBursts[i].startMs - sizedBursts[i - 1].startMs;
        const chainBreaksHere =
          atEnd || interval === null || !inRange(interval, o.minBreathIntervalMs, o.maxBreathIntervalMs);
        if (chainBreaksHere) {
          const chain = sizedBursts.slice(chainStart, i);
          if (chain.length >= o.minRunBursts) {
            const intervals: number[] = [];
            for (let k = 1; k < chain.length; k++) {
              intervals.push(chain[k].startMs - chain[k - 1].startMs);
            }
            const m = mean(intervals);
            const cv = m === 0 ? Infinity : populationStdDev(intervals, m) / m;
            if (cv <= o.maxIntervalCv) {
              qualifyingBursts.push(...chain);
            }
          }
          chainStart = i;
        }
      }

      // --- Events: merge qualifying bursts separated by gaps <= eventMergeGapMs ---
      const groups: Burst[][] = [];
      let group: Burst[] = [];
      for (const b of qualifyingBursts) {
        if (group.length === 0) {
          group.push(b);
          continue;
        }
        const gap = b.startMs - group[group.length - 1].endMs;
        if (gap <= o.eventMergeGapMs) {
          group.push(b);
        } else {
          groups.push(group);
          group = [b];
        }
      }
      if (group.length > 0) groups.push(group);

      const events: SnoreEvent[] = [];
      for (const g of groups) {
        const startMs = g[0].startMs;
        const endMs = g[g.length - 1].endMs;
        const frameIdx = g.flatMap((b) => b.frameIndices);
        const dbfsValues = frameIdx.map((idx) => frames[idx].rmsDbfs);
        const lowRatios = frameIdx.map((idx) => frames[idx].lowBandRatio);
        const avgDbfs = mean(dbfsValues);
        // NOT `Math.max(...dbfsValues)`: a merged event over a full night of
        // steady snoring at the 64ms production hop can have well over 100k
        // candidate frames, and spreading that many arguments into Math.max
        // exceeds V8's call-argument ceiling (RangeError). A reduce has no
        // such limit.
        const peakDbfs = dbfsValues.reduce((max, v) => (v > max ? v : max), -Infinity);
        const meanLowBandRatio = mean(lowRatios);
        const floorAtEventStart = floors[frameIdx[0]];

        const onsets = g.map((b) => b.startMs);
        const intervals: number[] = [];
        for (let k = 1; k < onsets.length; k++) intervals.push(onsets[k] - onsets[k - 1]);
        const intervalMean = mean(intervals);
        const cv = intervals.length === 0 || intervalMean === 0
          ? 0
          : populationStdDev(intervals, intervalMean) / intervalMean;

        // UNCLAMPED per the brief's verbatim formula — only the final
        // weighted sum is clamped below. A merged event whose combined
        // burst intervals are irregular enough (cv > MAX_INTERVAL_CV) can
        // and should push regularity negative, pulling confidence down
        // rather than being floored at 0 here.
        const regularity = 1 - cv / o.maxIntervalCv;
        const lowBandMargin = clamp01((meanLowBandRatio - o.minLowBandRatio) / (1 - o.minLowBandRatio));
        const loudnessMargin = clamp01((avgDbfs - floorAtEventStart - o.candidateDeltaDb) / 20);
        const runLength = clamp01(g.length / 8);

        const confidence = round2(
          clamp01(0.35 * regularity + 0.25 * lowBandMargin + 0.25 * loudnessMargin + 0.15 * runLength)
        );
        if (confidence < o.minEventConfidence) continue;

        events.push({ startMs, endMs, avgDbfs, peakDbfs, confidence });
      }

      return { events, noiseFloorDbfs: median(floors), analysisVersion: ANALYSIS_VERSION };
    },
  };
}
