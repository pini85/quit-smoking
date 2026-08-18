import { describe, expect, it } from 'vitest';
import { createSnoreDetector } from '@/domain/snore/detect';
import { ANALYSIS_VERSION } from '@/domain/snore/constants';
import { makeFrames } from './helpers/snoreFrames';

const QUIET: { dbfs: number; lowBandRatio: number; midBandRatio: number } = {
  dbfs: -50,
  lowBandRatio: 0.2,
  midBandRatio: 0.2,
};

const RHYTHMIC_BURST = { dbfs: -35, lowBandRatio: 0.7, midBandRatio: 0.1 }; // floor(-50) + 15dB

describe('createSnoreDetector — no signal', () => {
  it('returns no events for all-silence frames', () => {
    const frames = makeFrames({ hopMs: 100, totalMs: 120_000, silence: QUIET });
    const result = createSnoreDetector().analyze(frames);
    expect(result.events).toEqual([]);
    expect(result.noiseFloorDbfs).toBe(-50);
    expect(result.analysisVersion).toBe(ANALYSIS_VERSION);
  });

  it('returns an empty analysis (with ANALYSIS_VERSION) for zero frames', () => {
    const result = createSnoreDetector().analyze([]);
    expect(result.events).toEqual([]);
    expect(result.analysisVersion).toBe(ANALYSIS_VERSION);
  });
});

describe('createSnoreDetector — textbook rhythmic pattern', () => {
  it('detects 1s bursts every 4s (+15dB, low-band 0.7, mid 0.1) as a single event spanning the whole run', () => {
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 20_000,
      silence: QUIET,
      bursts: [
        { startMs: 5000, durationMs: 1000, ...RHYTHMIC_BURST },
        { startMs: 9000, durationMs: 1000, ...RHYTHMIC_BURST },
        { startMs: 13000, durationMs: 1000, ...RHYTHMIC_BURST },
        { startMs: 17000, durationMs: 1000, ...RHYTHMIC_BURST },
      ],
    });
    const result = createSnoreDetector().analyze(frames);
    expect(result.events).toHaveLength(1);
    const [event] = result.events;
    expect(event.startMs).toBe(5000);
    expect(event.endMs).toBe(18000);
    expect(event.avgDbfs).toBe(-35);
    expect(event.peakDbfs).toBe(-35);
    // regularity=1 (cv=0), lowBandMargin=0.4, loudnessMargin=0.35, runLength=4/8=0.5
    // confidence = 0.35*1 + 0.25*0.4 + 0.25*0.35 + 0.15*0.5 = 0.6125 -> 0.61
    expect(event.confidence).toBe(0.61);
  });
});

describe('createSnoreDetector — rejections', () => {
  it('rejects a high midBandRatio (speech/TV) pattern even with otherwise-perfect rhythm and low-band', () => {
    const speechLike = { dbfs: -35, lowBandRatio: 0.7, midBandRatio: 0.5 };
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 20_000,
      silence: QUIET,
      bursts: [
        { startMs: 5000, durationMs: 1000, ...speechLike },
        { startMs: 9000, durationMs: 1000, ...speechLike },
        { startMs: 13000, durationMs: 1000, ...speechLike },
        { startMs: 17000, durationMs: 1000, ...speechLike },
      ],
    });
    expect(createSnoreDetector().analyze(frames).events).toEqual([]);
  });

  it('rejects a single loud bang — no rhythm to qualify it', () => {
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 10_000,
      silence: QUIET,
      bursts: [{ startMs: 5000, durationMs: 1000, ...RHYTHMIC_BURST }],
    });
    expect(createSnoreDetector().analyze(frames).events).toEqual([]);
  });

  it('rejects a 2-burst run — below MIN_RUN_BURSTS (3)', () => {
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 15_000,
      silence: QUIET,
      bursts: [
        { startMs: 5000, durationMs: 1000, ...RHYTHMIC_BURST },
        { startMs: 9000, durationMs: 1000, ...RHYTHMIC_BURST },
      ],
    });
    expect(createSnoreDetector().analyze(frames).events).toEqual([]);
  });

  it('rejects irregular intervals whose coefficient of variation exceeds 0.5 (2000/9000/2000ms, cv=0.636)', () => {
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 30_000,
      silence: QUIET,
      bursts: [
        { startMs: 5000, durationMs: 1000, ...RHYTHMIC_BURST },
        { startMs: 7000, durationMs: 1000, ...RHYTHMIC_BURST }, // +2000
        { startMs: 16000, durationMs: 1000, ...RHYTHMIC_BURST }, // +9000
        { startMs: 18000, durationMs: 1000, ...RHYTHMIC_BURST }, // +2000
      ],
    });
    expect(createSnoreDetector().analyze(frames).events).toEqual([]);
  });

  it('rejects intervals outside [MIN_BREATH_INTERVAL_MS, MAX_BREATH_INTERVAL_MS] (bursts every 1000ms — too fast)', () => {
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 10_000,
      silence: QUIET,
      bursts: [
        { startMs: 5000, durationMs: 300, ...RHYTHMIC_BURST },
        { startMs: 6000, durationMs: 300, ...RHYTHMIC_BURST },
        { startMs: 7000, durationMs: 300, ...RHYTHMIC_BURST },
        { startMs: 8000, durationMs: 300, ...RHYTHMIC_BURST },
      ],
    });
    expect(createSnoreDetector().analyze(frames).events).toEqual([]);
  });

  it('rejects a burst longer than MAX_BURST_MS (5000ms) — a single 6s candidate span', () => {
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 10_000,
      silence: QUIET,
      bursts: [{ startMs: 2000, durationMs: 6000, ...RHYTHMIC_BURST }],
    });
    expect(createSnoreDetector().analyze(frames).events).toEqual([]);
  });
});

describe('createSnoreDetector — burst gap bridging', () => {
  it('bridges an internal candidate gap of exactly BURST_GAP_TOLERANCE_MS (200ms) into a single burst', () => {
    // Each "group" is two 300ms candidate sub-segments separated by a 200ms
    // gap (bridged into ONE burst). Three such groups, 4000ms apart (cv=0),
    // qualify as ONE event with burstCount=3 (not 6) — the confidence below
    // is only reachable if bridging collapses each group into one burst.
    const bursts = [0, 4000, 8000].flatMap((base) => [
      { startMs: 5000 + base, durationMs: 300, ...RHYTHMIC_BURST },
      { startMs: 5500 + base, durationMs: 300, ...RHYTHMIC_BURST }, // gap = 200ms after the first sub-segment ends
    ]);
    const frames = makeFrames({ hopMs: 100, totalMs: 20_000, silence: QUIET, bursts });
    const result = createSnoreDetector().analyze(frames);
    expect(result.events).toHaveLength(1);
    const [event] = result.events;
    expect(event.startMs).toBe(5000);
    expect(event.endMs).toBe(13800);
    // regularity=1, lowBandMargin=0.4, loudnessMargin=0.35, runLength=3/8=0.375
    // confidence = 0.35 + 0.1 + 0.0875 + 0.05625 = 0.59375 -> 0.59
    expect(event.confidence).toBe(0.59);
  });
});

describe('createSnoreDetector — event merging across gaps', () => {
  // Deliberately strong on every OTHER confidence term (max low-band ratio,
  // large loudness margin) so that this test isolates the merge/gap boundary
  // behavior: the merged event's regularity term takes a real hit from the
  // one large inter-chain interval, and a weaker signal would push total
  // confidence below MIN_EVENT_CONFIDENCE, hiding the merge behind a drop.
  const STRONG_BURST = { dbfs: -22, lowBandRatio: 1.0, midBandRatio: 0.1 }; // floor(-50) + 28dB

  function chain(startAt: number) {
    return [0, 4000, 8000].map((offset) => ({
      startMs: startAt + offset,
      durationMs: 1000,
      ...STRONG_BURST,
    }));
  }

  it('merges two qualifying runs separated by exactly EVENT_MERGE_GAP_MS (10000ms) into one event', () => {
    // Chain A bursts: 5000,9000,13000 (each 1000ms) -> last burst ends at 14000.
    // Chain B starts at 14000 + 10000 = 24000, so the gap between chains is exactly 10000ms.
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 40_000,
      silence: QUIET,
      bursts: [...chain(5000), ...chain(24000)],
    });
    const result = createSnoreDetector().analyze(frames);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].startMs).toBe(5000);
    expect(result.events[0].endMs).toBe(33000);
  });

  it('does NOT merge two qualifying runs separated by EVENT_MERGE_GAP_MS + one hop (10100ms)', () => {
    // Same as above but chain B starts one 100ms hop later, so the gap is 10100ms.
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 40_000,
      silence: QUIET,
      bursts: [...chain(5000), ...chain(24100)],
    });
    const result = createSnoreDetector().analyze(frames);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].startMs).toBe(5000);
    expect(result.events[0].endMs).toBe(14000);
    expect(result.events[1].startMs).toBe(24100);
    expect(result.events[1].endMs).toBe(33100);
  });
});

describe('createSnoreDetector — drifting noise floor', () => {
  it('adapts to a +20dB background jump: a fixed +15dB-relative burst is still detected, a fixed -25dBFS burst (only +5dB over the NEW floor) is not', () => {
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 190_000,
      silence: (t) => (t < 60_000 ? QUIET : { dbfs: -30, lowBandRatio: 0.2, midBandRatio: 0.2 }),
      bursts: [
        // "Would have been loud" under the OLD floor (-50), but only +5dB
        // over the NEW floor (-30) — below CANDIDATE_DELTA_DB (8) — so it
        // must NOT be detected once the floor has adapted.
        { startMs: 130_000, durationMs: 1000, dbfs: -25, lowBandRatio: 0.7, midBandRatio: 0.1 },
        { startMs: 134_000, durationMs: 1000, dbfs: -25, lowBandRatio: 0.7, midBandRatio: 0.1 },
        { startMs: 138_000, durationMs: 1000, dbfs: -25, lowBandRatio: 0.7, midBandRatio: 0.1 },
        // Genuinely +15dB over the NEW floor (-30) — must be detected.
        { startMs: 150_000, durationMs: 1000, dbfs: -15, lowBandRatio: 0.7, midBandRatio: 0.1 },
        { startMs: 154_000, durationMs: 1000, dbfs: -15, lowBandRatio: 0.7, midBandRatio: 0.1 },
        { startMs: 158_000, durationMs: 1000, dbfs: -15, lowBandRatio: 0.7, midBandRatio: 0.1 },
      ],
    });
    const result = createSnoreDetector().analyze(frames);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].startMs).toBe(150_000);
    expect(result.events[0].endMs).toBe(159_000);
  });
});

describe('createSnoreDetector — confidence ordering and the MIN_EVENT_CONFIDENCE cut', () => {
  it('scores a perfectly regular run higher than a sloppier (but still qualifying) one, and drops a run whose confidence falls below 0.4', () => {
    const cleanBursts = [5000, 9000, 13000, 17000].map((startMs) => ({
      startMs,
      durationMs: 1000,
      ...RHYTHMIC_BURST,
    }));
    // Intervals 3000/5500/3500ms: all within [2000,10000], cv≈0.27 (qualifies, but less regular than the clean run).
    const sloppyBursts = [40_000, 43_000, 48_500, 52_000].map((startMs) => ({
      startMs,
      durationMs: 1000,
      ...RHYTHMIC_BURST,
    }));
    // Right at every boundary at once: cv=0.5 (max allowed), lowBandRatio at
    // the MIN_LOW_BAND_RATIO floor, loudness exactly at CANDIDATE_DELTA_DB —
    // every confidence term is 0 except a small runLength contribution, so
    // confidence rounds to 0.06, below MIN_EVENT_CONFIDENCE (0.4).
    const barelyQualifyingBursts = [
      { startMs: 80_000, durationMs: 1000, dbfs: -42, lowBandRatio: 0.5, midBandRatio: 0.1 },
      { startMs: 82_000, durationMs: 1000, dbfs: -42, lowBandRatio: 0.5, midBandRatio: 0.1 }, // +2000
      { startMs: 88_000, durationMs: 1000, dbfs: -42, lowBandRatio: 0.5, midBandRatio: 0.1 }, // +6000
    ];

    const frames = makeFrames({
      hopMs: 100,
      totalMs: 100_000,
      silence: QUIET,
      bursts: [...cleanBursts, ...sloppyBursts, ...barelyQualifyingBursts],
    });
    const result = createSnoreDetector().analyze(frames);
    expect(result.events).toHaveLength(2);
    const [clean, sloppy] = result.events;
    expect(clean.startMs).toBe(5000);
    expect(clean.confidence).toBe(0.61);
    expect(sloppy.startMs).toBe(40_000);
    expect(sloppy.confidence).toBe(0.42);
    expect(clean.confidence).toBeGreaterThan(sloppy.confidence);
  });
});

describe('createSnoreDetector — DetectorOptions overrides', () => {
  it('accepts an overridden minRunBursts, turning an otherwise-rejected 2-burst run into an event', () => {
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 15_000,
      silence: QUIET,
      bursts: [
        { startMs: 5000, durationMs: 1000, ...RHYTHMIC_BURST },
        { startMs: 9000, durationMs: 1000, ...RHYTHMIC_BURST },
      ],
    });
    const defaultResult = createSnoreDetector().analyze(frames);
    expect(defaultResult.events).toEqual([]);

    const overriddenResult = createSnoreDetector().analyze(frames, { minRunBursts: 2 });
    expect(overriddenResult.events).toHaveLength(1);
  });
});
