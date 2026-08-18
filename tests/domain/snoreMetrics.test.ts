import { describe, expect, it } from 'vitest';
import type { SnoreEvent } from '@/domain/types';
import { computeMetrics, intensityBand, intensityFromDbfs } from '@/domain/snore/metrics';

function event(overrides: Partial<SnoreEvent> & Pick<SnoreEvent, 'startMs' | 'endMs'>): SnoreEvent {
  return { avgDbfs: -30, peakDbfs: -25, confidence: 0.6, ...overrides };
}

describe('intensityFromDbfs', () => {
  it('maps -60dBFS to 0 and -10dBFS to 1 (the documented endpoints)', () => {
    expect(intensityFromDbfs(-60)).toBe(0);
    expect(intensityFromDbfs(-10)).toBe(1);
  });

  it('clamps below -60dBFS to 0 and above -10dBFS to 1', () => {
    expect(intensityFromDbfs(-90)).toBe(0);
    expect(intensityFromDbfs(0)).toBe(1);
  });

  it('is linear in between (e.g. -35dBFS is the midpoint -> 0.5)', () => {
    expect(intensityFromDbfs(-35)).toBe(0.5);
  });
});

describe('intensityBand', () => {
  it('classifies below each boundary into the lower band', () => {
    expect(intensityBand(0)).toBe('quiet');
    expect(intensityBand(0.24)).toBe('quiet');
    expect(intensityBand(0.49)).toBe('moderate');
    expect(intensityBand(0.74)).toBe('loud');
  });

  it('classifies exactly AT each boundary into the upper band (strict "<" comparisons)', () => {
    expect(intensityBand(0.25)).toBe('moderate');
    expect(intensityBand(0.5)).toBe('loud');
    expect(intensityBand(0.75)).toBe('veryLoud');
  });

  it('classifies 1.0 as veryLoud', () => {
    expect(intensityBand(1)).toBe('veryLoud');
  });
});

describe('computeMetrics — empty events', () => {
  it('returns all-zero metrics (except recordingDurationMs) when there are no events', () => {
    const metrics = computeMetrics([], 8 * 3_600_000);
    expect(metrics).toEqual({
      recordingDurationMs: 8 * 3_600_000,
      snoreDurationMs: 0,
      snorePercent: 0,
      eventCount: 0,
      eventsPerHour: 0,
      avgIntensity: 0,
      peakIntensity: 0,
      longestEpisodeMs: 0,
      avgEventDurationMs: 0,
      snoreBurden: 0,
    });
  });
});

describe('computeMetrics — hand-built events, every field checked', () => {
  it('computes every metric from 3 events over an 8-hour recording', () => {
    const events: SnoreEvent[] = [
      event({ startMs: 0, endMs: 600_000, avgDbfs: -30, peakDbfs: -25, confidence: 0.7 }),
      event({ startMs: 1_200_000, endMs: 1_800_000, avgDbfs: -20, peakDbfs: -10, confidence: 0.8 }),
      event({ startMs: 10_000_000, endMs: 10_300_000, avgDbfs: -40, peakDbfs: -35, confidence: 0.5 }),
    ];
    const recordingDurationMs = 8 * 3_600_000; // 28,800,000ms
    const metrics = computeMetrics(events, recordingDurationMs);

    expect(metrics.recordingDurationMs).toBe(recordingDurationMs);
    expect(metrics.eventCount).toBe(3);
    // snoreDurationMs = 600000 + 600000 + 300000
    expect(metrics.snoreDurationMs).toBe(1_500_000);
    // snorePercent = round1(100 * 1500000 / 28800000) = round1(5.208333) = 5.2
    expect(metrics.snorePercent).toBe(5.2);
    // eventsPerHour = round1(3 / (28800000/3600000)) = round1(3/8) = round1(0.375) = 0.4
    expect(metrics.eventsPerHour).toBe(0.4);
    // duration-weighted mean avgDbfs = (-30*600000 + -20*600000 + -40*300000) / 1500000 = -28
    // intensityFromDbfs(-28) = (-28+60)/50 = 0.64
    expect(metrics.avgIntensity).toBe(0.64);
    // peakIntensity: max peakDbfs = -10 -> intensityFromDbfs(-10) = 1
    expect(metrics.peakIntensity).toBe(1);
    // longestEpisodeMs: gaps between events (600000ms, 8200000ms) both far exceed
    // EPISODE_MERGE_GAP_MS (60000ms), so episodes are NOT merged; longest single
    // event duration is 600000ms (a tie between events 1 and 2).
    expect(metrics.longestEpisodeMs).toBe(600_000);
    // avgEventDurationMs = round(1500000 / 3) = 500000
    expect(metrics.avgEventDurationMs).toBe(500_000);
    // snoreBurden: durationScore=min(1,5.2/40)=0.13, frequencyScore=min(1,0.4/15)=0.026667,
    // intensityScore=0.64 -> round(100*(0.4*0.13+0.3*0.026667+0.3*0.64)) = round(25.2) = 25
    expect(metrics.snoreBurden).toBe(25);
  });
});

describe('computeMetrics — recordingDurationMs === 0', () => {
  it('forces snorePercent and eventsPerHour to 0 even with events present', () => {
    const events: SnoreEvent[] = [event({ startMs: 0, endMs: 1000 })];
    const metrics = computeMetrics(events, 0);
    expect(metrics.snorePercent).toBe(0);
    expect(metrics.eventsPerHour).toBe(0);
    // Unaffected by recordingDurationMs === 0 — still derived purely from events.
    expect(metrics.snoreDurationMs).toBe(1000);
    expect(metrics.avgEventDurationMs).toBe(1000);
  });
});

describe('computeMetrics — episode merging boundary', () => {
  it('merges two events across a gap of exactly EPISODE_MERGE_GAP_MS (60000ms)', () => {
    const events: SnoreEvent[] = [
      event({ startMs: 0, endMs: 100_000 }), // 100s
      event({ startMs: 160_000, endMs: 210_000 }), // gap = 160000 - 100000 = 60000 -> merges
    ];
    const metrics = computeMetrics(events, 24 * 3_600_000);
    // Merged episode spans [0, 210000) = 210000ms.
    expect(metrics.longestEpisodeMs).toBe(210_000);
  });

  it('does NOT merge two events across a gap of EPISODE_MERGE_GAP_MS + 1ms (60001ms)', () => {
    const events: SnoreEvent[] = [
      event({ startMs: 0, endMs: 100_000 }), // 100s
      event({ startMs: 160_001, endMs: 210_001 }), // gap = 60001 -> does not merge
    ];
    const metrics = computeMetrics(events, 24 * 3_600_000);
    // Longest of the two UN-merged episodes: 100000ms vs 50000ms.
    expect(metrics.longestEpisodeMs).toBe(100_000);
  });
});
