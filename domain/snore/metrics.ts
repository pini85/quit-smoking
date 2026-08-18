/**
 * Per-night snore metrics, derived from a SleepSession's detected events.
 * Pure: takes `events`/`recordingDurationMs` explicitly, no wall-clock access.
 */

import type { SnoreEvent, SleepSessionMetrics } from '@/domain/types';
import { EPISODE_MERGE_GAP_MS } from '@/domain/snore/constants';
import { clamp01, round1 } from '@/domain/snore/math';
import { snoreBurden } from '@/domain/snore/burden';

/** Relative scale, NEVER calibrated SPL: -60dBFS -> 0, -10dBFS -> 1, clamped outside that range. */
export function intensityFromDbfs(dbfs: number): number {
  return clamp01((dbfs + 60) / 50);
}

export function intensityBand(intensity: number): 'quiet' | 'moderate' | 'loud' | 'veryLoud' {
  if (intensity < 0.25) return 'quiet';
  if (intensity < 0.5) return 'moderate';
  if (intensity < 0.75) return 'loud';
  return 'veryLoud';
}

/** Longest run of events merged across gaps <= EPISODE_MERGE_GAP_MS. 0 when there are no events. */
function longestEpisodeMs(events: SnoreEvent[]): number {
  if (events.length === 0) return 0;
  const sorted = [...events].sort((a, b) => a.startMs - b.startMs);

  let longest = 0;
  let episodeStart = sorted[0].startMs;
  let episodeEnd = sorted[0].endMs;
  for (let i = 1; i < sorted.length; i++) {
    const e = sorted[i];
    const gap = e.startMs - episodeEnd;
    if (gap <= EPISODE_MERGE_GAP_MS) {
      episodeEnd = Math.max(episodeEnd, e.endMs);
    } else {
      longest = Math.max(longest, episodeEnd - episodeStart);
      episodeStart = e.startMs;
      episodeEnd = e.endMs;
    }
  }
  return Math.max(longest, episodeEnd - episodeStart);
}

export function computeMetrics(events: SnoreEvent[], recordingDurationMs: number): SleepSessionMetrics {
  const eventCount = events.length;
  const snoreDurationMs = events.reduce((sum, e) => sum + (e.endMs - e.startMs), 0);

  const snorePercent =
    recordingDurationMs === 0 ? 0 : round1((100 * snoreDurationMs) / recordingDurationMs);
  const eventsPerHour =
    recordingDurationMs === 0 ? 0 : round1(eventCount / (recordingDurationMs / 3_600_000));

  const avgIntensity =
    eventCount === 0
      ? 0
      : intensityFromDbfs(
          events.reduce((sum, e) => sum + e.avgDbfs * (e.endMs - e.startMs), 0) / snoreDurationMs
        );
  const peakIntensity =
    eventCount === 0 ? 0 : intensityFromDbfs(Math.max(...events.map((e) => e.peakDbfs)));

  const avgEventDurationMs = eventCount === 0 ? 0 : Math.round(snoreDurationMs / eventCount);

  const metrics: SleepSessionMetrics = {
    recordingDurationMs,
    snoreDurationMs,
    snorePercent,
    eventCount,
    eventsPerHour,
    avgIntensity,
    peakIntensity,
    longestEpisodeMs: longestEpisodeMs(events),
    avgEventDurationMs,
    snoreBurden: 0,
  };
  metrics.snoreBurden = snoreBurden(metrics);
  return metrics;
}
