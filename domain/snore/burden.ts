/**
 * Snore Burden — an INTERNAL app metric (0-100) for night-over-night trends.
 * NOT a validated medical score; diagnoses nothing.
 *
 *   durationScore  = min(1, snorePercent / 40)   // 40% of the night saturates
 *   frequencyScore = min(1, eventsPerHour / 15)  // 15 events/hr saturates
 *   intensityScore = avgIntensity                // already 0..1
 *   snoreBurden    = round(100 * (0.4*durationScore + 0.3*frequencyScore + 0.3*intensityScore))
 */

import type { SleepSessionMetrics } from '@/domain/types';

export function snoreBurden(
  m: Pick<SleepSessionMetrics, 'snorePercent' | 'eventsPerHour' | 'avgIntensity'>
): number {
  const durationScore = Math.min(1, m.snorePercent / 40);
  const frequencyScore = Math.min(1, m.eventsPerHour / 15);
  const intensityScore = m.avgIntensity;
  return Math.round(100 * (0.4 * durationScore + 0.3 * frequencyScore + 0.3 * intensityScore));
}
