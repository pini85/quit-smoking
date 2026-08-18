import { describe, expect, it } from 'vitest';
import { snoreBurden } from '@/domain/snore/burden';

describe('snoreBurden', () => {
  it('is 0 for all-zero inputs', () => {
    expect(snoreBurden({ snorePercent: 0, eventsPerHour: 0, avgIntensity: 0 })).toBe(0);
  });

  it('is 100 when every component is fully saturated', () => {
    expect(snoreBurden({ snorePercent: 40, eventsPerHour: 15, avgIntensity: 1 })).toBe(100);
  });

  describe('component isolation (others held at 0)', () => {
    it('duration alone at saturation (40%): 0.4 weight * 100 = 40', () => {
      expect(snoreBurden({ snorePercent: 40, eventsPerHour: 0, avgIntensity: 0 })).toBe(40);
    });

    it('frequency alone at saturation (15/hr): 0.3 weight * 100 = 30', () => {
      expect(snoreBurden({ snorePercent: 0, eventsPerHour: 15, avgIntensity: 0 })).toBe(30);
    });

    it('intensity alone at saturation (1.0): 0.3 weight * 100 = 30', () => {
      expect(snoreBurden({ snorePercent: 0, eventsPerHour: 0, avgIntensity: 1 })).toBe(30);
    });
  });

  describe('saturation caps', () => {
    it('durationScore saturates at exactly 40% and does not grow beyond it', () => {
      const at40 = snoreBurden({ snorePercent: 40, eventsPerHour: 0, avgIntensity: 0 });
      const above40 = snoreBurden({ snorePercent: 80, eventsPerHour: 0, avgIntensity: 0 });
      expect(at40).toBe(40);
      expect(above40).toBe(40);
    });

    it('frequencyScore saturates at exactly 15 events/hour and does not grow beyond it', () => {
      const at15 = snoreBurden({ snorePercent: 0, eventsPerHour: 15, avgIntensity: 0 });
      const above15 = snoreBurden({ snorePercent: 0, eventsPerHour: 30, avgIntensity: 0 });
      expect(at15).toBe(30);
      expect(above15).toBe(30);
    });
  });

  it('blends all three components with their documented weights (0.4/0.3/0.3)', () => {
    // durationScore = 20/40 = 0.5, frequencyScore = 7.5/15 = 0.5, intensityScore = 0.5
    // burden = round(100 * (0.4*0.5 + 0.3*0.5 + 0.3*0.5)) = round(50) = 50
    expect(snoreBurden({ snorePercent: 20, eventsPerHour: 7.5, avgIntensity: 0.5 })).toBe(50);
  });

  it('rounds to the nearest integer rather than truncating', () => {
    // durationScore = 5/40 = 0.125 -> *0.4 = 0.05
    // frequencyScore = 1/15 = 0.0666... -> *0.3 = 0.02
    // intensityScore = 0.13 -> *0.3 = 0.039
    // sum = 0.109 -> *100 = 10.9 -> round = 11 (not truncated to 10)
    expect(snoreBurden({ snorePercent: 5, eventsPerHour: 1, avgIntensity: 0.13 })).toBe(11);
  });
});
