import { describe, expect, it } from 'vitest';
import type { SleepSession, SleepSessionMetrics } from '@/domain/types';
import { MIN_ANALYZABLE_MS } from '@/domain/snore/constants';
import {
  computeSnoreTrends,
  MIN_NIGHTS_ROLLING,
  MIN_NIGHTS_BASELINE,
  MIN_NIGHTS_PRE_QUIT,
} from '@/domain/snore/trends';

const DAY_MS = 86_400_000;
const SEVEN_DAYS_MS = 7 * DAY_MS;
const NOW_MS = Date.parse('2026-03-15T08:00:00.000Z');
const NOW = new Date(NOW_MS);

let idCounter = 0;

function metrics(overrides: Partial<SleepSessionMetrics> = {}): SleepSessionMetrics {
  return {
    recordingDurationMs: MIN_ANALYZABLE_MS,
    snoreDurationMs: 0,
    snorePercent: 0,
    eventCount: 0,
    eventsPerHour: 0,
    avgIntensity: 0,
    peakIntensity: 0,
    longestEpisodeMs: 0,
    avgEventDurationMs: 0,
    snoreBurden: 0,
    ...overrides,
  };
}

/** Fabricates an 'analyzed' night at `startedAt` (epoch ms or ISO string). */
function night(
  startedAt: number | string,
  metricsOverrides: Partial<SleepSessionMetrics> = {},
  sessionOverrides: Partial<SleepSession> = {}
): SleepSession {
  idCounter += 1;
  return {
    id: `night-${idCounter}`,
    startedAt: typeof startedAt === 'number' ? new Date(startedAt).toISOString() : startedAt,
    state: 'analyzed',
    analysisVersion: 'ts-1.0.0',
    metrics: metrics(metricsOverrides),
    events: [],
    ...sessionOverrides,
  };
}

const daysAgo = (n: number) => NOW_MS - n * DAY_MS;

describe('computeSnoreTrends — analyzable night definition', () => {
  it('excludes a session below MIN_ANALYZABLE_MS', () => {
    const sessions = [night(daysAgo(1), { recordingDurationMs: MIN_ANALYZABLE_MS - 1 })];
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.analyzableNights).toBe(0);
    expect(trends.lastNight).toBeNull();
  });

  it('includes a session at exactly MIN_ANALYZABLE_MS', () => {
    const sessions = [night(daysAgo(1), { recordingDurationMs: MIN_ANALYZABLE_MS })];
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.analyzableNights).toBe(1);
    expect(trends.lastNight).not.toBeNull();
  });

  it("excludes 'recorded' and 'failed' sessions even when metrics happen to be present", () => {
    const recorded = night(daysAgo(1), {}, { state: 'recorded', analysisVersion: undefined });
    const failed = night(daysAgo(2), {}, { state: 'failed', analysisVersion: undefined });
    const analyzed = night(daysAgo(3));
    const trends = computeSnoreTrends([recorded, failed, analyzed], null, NOW);
    expect(trends.analyzableNights).toBe(1);
    expect(trends.nightSeries).toHaveLength(1);
  });

  it("excludes an 'analyzed' session with no metrics object", () => {
    const malformed = night(daysAgo(1), {}, { metrics: undefined });
    const trends = computeSnoreTrends([malformed], null, NOW);
    expect(trends.analyzableNights).toBe(0);
  });
});

describe('computeSnoreTrends — empty input', () => {
  it('returns all nulls, empty arrays, and 0 analyzable nights', () => {
    const trends = computeSnoreTrends([], null, NOW);
    expect(trends).toEqual({
      analyzableNights: 0,
      lastNight: null,
      sevenNightAvg: null,
      firstNightsBaseline: null,
      preQuitBaseline: null,
      vsBaseline: [],
      nightSeries: [],
    });
  });
});

describe('computeSnoreTrends — lastNight', () => {
  it("is the most recent analyzable night's stored metrics, regardless of input order", () => {
    const oldest = night(daysAgo(5), { snoreBurden: 10 });
    const newest = night(daysAgo(1), { snoreBurden: 90 });
    const middle = night(daysAgo(3), { snoreBurden: 50 });
    // Deliberately unsorted input.
    const trends = computeSnoreTrends([middle, newest, oldest], null, NOW);
    expect(trends.lastNight).toBe(newest.metrics);
  });
});

describe('computeSnoreTrends — sevenNightAvg gate (MIN_NIGHTS_ROLLING)', () => {
  it('is null with one night fewer than the gate, all clearly within the window', () => {
    const sessions = Array.from({ length: MIN_NIGHTS_ROLLING - 1 }, (_, i) => night(daysAgo(i + 1)));
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.sevenNightAvg).toBeNull();
  });

  it('is present with exactly the gate count', () => {
    const sessions = Array.from({ length: MIN_NIGHTS_ROLLING }, (_, i) => night(daysAgo(i + 1)));
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.sevenNightAvg).not.toBeNull();
    expect(trends.sevenNightAvg?.nights).toBe(MIN_NIGHTS_ROLLING);
  });
});

describe('computeSnoreTrends — 7-day window boundary', () => {
  it('includes a night at exactly (7 days - 1ms) before now', () => {
    const boundary = night(NOW_MS - (SEVEN_DAYS_MS - 1));
    const recent1 = night(daysAgo(1));
    const recent2 = night(daysAgo(2));
    const trends = computeSnoreTrends([boundary, recent1, recent2], null, NOW);
    expect(trends.sevenNightAvg).not.toBeNull();
    expect(trends.sevenNightAvg?.nights).toBe(3);
  });

  it('excludes a night at exactly 7 days before now', () => {
    const boundary = night(NOW_MS - SEVEN_DAYS_MS);
    const recent1 = night(daysAgo(1));
    const recent2 = night(daysAgo(2));
    const trends = computeSnoreTrends([boundary, recent1, recent2], null, NOW);
    // Only recent1/recent2 qualify -> 2, below MIN_NIGHTS_ROLLING (3).
    expect(trends.sevenNightAvg).toBeNull();
  });
});

describe('computeSnoreTrends — firstNightsBaseline gate (MIN_NIGHTS_BASELINE)', () => {
  it('is null with one night fewer than the gate', () => {
    const sessions = Array.from({ length: MIN_NIGHTS_BASELINE - 1 }, (_, i) => night(daysAgo(30 - i)));
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.firstNightsBaseline).toBeNull();
  });

  it('is present with exactly the gate count', () => {
    const sessions = Array.from({ length: MIN_NIGHTS_BASELINE }, (_, i) => night(daysAgo(30 - i)));
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.firstNightsBaseline).not.toBeNull();
    expect(trends.firstNightsBaseline?.nights).toBe(MIN_NIGHTS_BASELINE);
  });

  it('takes exactly the first 7 chronologically, not all nights or the last 7', () => {
    // 10 nights, oldest to newest, burden = 10,20,...,100.
    const sessions = Array.from({ length: 10 }, (_, i) => night(daysAgo(30 - i), { snoreBurden: (i + 1) * 10 }));
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.firstNightsBaseline?.nights).toBe(7);
    // Mean of first 7 values (10..70) = 40.
    expect(trends.firstNightsBaseline?.means.snoreBurden).toBe(40);
  });
});

describe('computeSnoreTrends — preQuitBaseline gate (MIN_NIGHTS_PRE_QUIT)', () => {
  it('is null with one preQuit night fewer than the gate', () => {
    const sessions = Array.from({ length: MIN_NIGHTS_PRE_QUIT - 1 }, (_, i) =>
      night(daysAgo(60 - i), {}, { preQuit: true })
    );
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.preQuitBaseline).toBeNull();
  });

  it('is present with exactly the gate count of preQuit nights', () => {
    const sessions = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) =>
      night(daysAgo(60 - i), {}, { preQuit: true })
    );
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.preQuitBaseline).not.toBeNull();
    expect(trends.preQuitBaseline?.nights).toBe(MIN_NIGHTS_PRE_QUIT);
  });

  it('does not count non-preQuit nights toward the preQuit gate', () => {
    const preQuitNights = Array.from({ length: MIN_NIGHTS_PRE_QUIT - 1 }, (_, i) =>
      night(daysAgo(60 - i), {}, { preQuit: true })
    );
    const postQuitNights = Array.from({ length: 5 }, (_, i) => night(daysAgo(10 - i), {}, { preQuit: false }));
    const trends = computeSnoreTrends([...preQuitNights, ...postQuitNights], null, NOW);
    expect(trends.preQuitBaseline).toBeNull();
  });
});

describe('computeSnoreTrends — preQuit fallback inference from quitAt', () => {
  it('treats a session missing the preQuit flag as preQuit when startedAt < quitAt', () => {
    const quitAt = new Date(daysAgo(20));
    // 3 legacy/imported rows with no `preQuit` flag, all before quitAt.
    const sessions = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) => night(daysAgo(30 - i)));
    const trends = computeSnoreTrends(sessions, quitAt, NOW);
    expect(trends.preQuitBaseline).not.toBeNull();
    expect(trends.preQuitBaseline?.nights).toBe(MIN_NIGHTS_PRE_QUIT);
  });

  it('does not infer preQuit for a flagless row when quitAt is null', () => {
    const sessions = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) => night(daysAgo(30 - i)));
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.preQuitBaseline).toBeNull();
  });

  it('does not infer preQuit for a flagless row started after quitAt', () => {
    const quitAt = new Date(daysAgo(40));
    const sessions = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) => night(daysAgo(30 - i)));
    const trends = computeSnoreTrends(sessions, quitAt, NOW);
    expect(trends.preQuitBaseline).toBeNull();
  });

  it('respects an explicit preQuit: false even if startedAt < quitAt', () => {
    const quitAt = new Date(daysAgo(5));
    const sessions = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) =>
      night(daysAgo(30 - i), {}, { preQuit: false })
    );
    const trends = computeSnoreTrends(sessions, quitAt, NOW);
    expect(trends.preQuitBaseline).toBeNull();
  });
});

describe('computeSnoreTrends — vsBaseline current bucket selection', () => {
  it('uses sevenNightAvg as the current bucket when it is gated in', () => {
    // 3 recent nights (gates sevenNightAvg) with burden 60, plus a preQuit
    // reference of 3 nights with burden 40 (mean).
    const recent = Array.from({ length: 3 }, (_, i) => night(daysAgo(i + 1), { snoreBurden: 60 }));
    const preQuitReference = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) =>
      night(daysAgo(90 - i), { snoreBurden: 40 }, { preQuit: true })
    );
    const trends = computeSnoreTrends([...recent, ...preQuitReference], null, NOW);
    const cmp = trends.vsBaseline.find((c) => c.metric === 'snoreBurden');
    expect(cmp?.current).toBe(60);
    expect(cmp?.reference).toBe(40);
  });

  it('falls back to the last night alone when sevenNightAvg is not gated in', () => {
    // Only 1 night within the rolling window (below MIN_NIGHTS_ROLLING), so
    // sevenNightAvg is null and the current bucket must be that single night.
    const lastNight = night(daysAgo(1), { snoreBurden: 77 });
    const preQuitReference = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) =>
      night(daysAgo(90 - i), { snoreBurden: 40 }, { preQuit: true })
    );
    const trends = computeSnoreTrends([lastNight, ...preQuitReference], null, NOW);
    expect(trends.sevenNightAvg).toBeNull();
    const cmp = trends.vsBaseline.find((c) => c.metric === 'snoreBurden');
    expect(cmp?.current).toBe(77);
  });
});

describe('computeSnoreTrends — vsBaseline reference bucket selection', () => {
  it('prefers preQuitBaseline over firstNightsBaseline when both are gated in', () => {
    // 5 non-preQuit nights, far apart in time so they double as
    // firstNightsBaseline (burden 20 mean), plus 3 preQuit nights (burden 40
    // mean) which must win as the reference.
    const firstNightsCandidates = Array.from({ length: 5 }, (_, i) =>
      night(daysAgo(200 - i * 20), { snoreBurden: 20 }, { preQuit: false })
    );
    const preQuitNights = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) =>
      night(daysAgo(300 - i), { snoreBurden: 40 }, { preQuit: true })
    );
    const lastNight = night(daysAgo(1), { snoreBurden: 60 });
    const trends = computeSnoreTrends([...firstNightsCandidates, ...preQuitNights, lastNight], null, NOW);
    expect(trends.firstNightsBaseline).not.toBeNull();
    expect(trends.preQuitBaseline).not.toBeNull();
    const cmp = trends.vsBaseline.find((c) => c.metric === 'snoreBurden');
    expect(cmp?.reference).toBe(40);
  });

  it('falls back to firstNightsBaseline when preQuitBaseline is not gated in', () => {
    const firstNights = Array.from({ length: 5 }, (_, i) =>
      night(daysAgo(200 - i * 20), { snoreBurden: 20 }, { preQuit: false })
    );
    const lastNight = night(daysAgo(1), { snoreBurden: 60 });
    const trends = computeSnoreTrends([...firstNights, lastNight], null, NOW);
    expect(trends.preQuitBaseline).toBeNull();
    const cmp = trends.vsBaseline.find((c) => c.metric === 'snoreBurden');
    expect(cmp?.reference).toBe(20);
  });

  it('produces no comparisons when neither reference baseline is gated in', () => {
    // Only 3 total analyzable nights: current bucket gates in (sevenNightAvg)
    // but neither firstNightsBaseline (needs 5) nor preQuitBaseline (needs 3
    // preQuit nights, none here) can gate in.
    const sessions = Array.from({ length: 3 }, (_, i) => night(daysAgo(i + 1)));
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.firstNightsBaseline).toBeNull();
    expect(trends.preQuitBaseline).toBeNull();
    expect(trends.vsBaseline).toEqual([]);
  });
});

describe('computeSnoreTrends — non-overlap exclusion', () => {
  it('vanishes comparisons when overlap removal drops the reference below its gate', () => {
    // 7 nights, all within the last 7 days of `now` AND simultaneously the
    // first 7 chronologically (only 7 nights exist at all). sevenNightAvg
    // (current) and firstNightsBaseline (reference) are therefore IDENTICAL
    // buckets; after excluding the overlap, 0 nights remain for the
    // reference (< MIN_NIGHTS_BASELINE), so comparisons vanish.
    const sessions = Array.from({ length: 7 }, (_, i) => night(daysAgo(i + 1)));
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.sevenNightAvg).not.toBeNull();
    expect(trends.firstNightsBaseline).not.toBeNull();
    expect(trends.vsBaseline).toEqual([]);
  });

  it('keeps comparisons when overlap removal leaves the reference exactly at its gate', () => {
    // 8 nights total. firstNightsBaseline = nights #1-7 (oldest 7). The
    // current bucket (sevenNightAvg) is nights #6-8 (the 3 most recent,
    // within the rolling window). Overlap {#6,#7} removed from the
    // reference leaves {#1..#5} = 5 nights = exactly MIN_NIGHTS_BASELINE.
    const sessions = [
      night(daysAgo(30), { snoreBurden: 10 }), // #1
      night(daysAgo(25), { snoreBurden: 10 }), // #2
      night(daysAgo(20), { snoreBurden: 10 }), // #3
      night(daysAgo(15), { snoreBurden: 10 }), // #4
      night(daysAgo(10), { snoreBurden: 10 }), // #5
      night(daysAgo(3), { snoreBurden: 90 }), // #6 (in rolling window)
      night(daysAgo(2), { snoreBurden: 90 }), // #7 (in rolling window)
      night(daysAgo(1), { snoreBurden: 90 }), // #8 (in rolling window)
    ];
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.sevenNightAvg?.nights).toBe(3);
    expect(trends.firstNightsBaseline?.nights).toBe(7);
    const cmp = trends.vsBaseline.find((c) => c.metric === 'snoreBurden');
    expect(cmp).toBeDefined();
    // Reference mean excludes the overlapping #6/#7 -> pure first-5 mean (10).
    expect(cmp?.reference).toBe(10);
    expect(cmp?.current).toBe(90);
  });
});

describe('computeSnoreTrends — zero reference', () => {
  it("omits a metric's comparison when its reference mean is 0, while other metrics are still compared", () => {
    const preQuitNights = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) =>
      night(daysAgo(90 - i), { avgIntensity: 0, snoreBurden: 40 }, { preQuit: true })
    );
    const lastNight = night(daysAgo(1), { avgIntensity: 0.5, snoreBurden: 60 });
    const trends = computeSnoreTrends([...preQuitNights, lastNight], null, NOW);
    expect(trends.vsBaseline.find((c) => c.metric === 'avgIntensity')).toBeUndefined();
    expect(trends.vsBaseline.find((c) => c.metric === 'snoreBurden')).toBeDefined();
  });
});

describe('computeSnoreTrends — delta sign and rounding', () => {
  it('rounds (63 vs 86) to -27 and preserves the negative sign', () => {
    const preQuitNights = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) =>
      night(daysAgo(90 - i), { snoreBurden: 86 }, { preQuit: true })
    );
    const lastNight = night(daysAgo(1), { snoreBurden: 63 });
    const trends = computeSnoreTrends([...preQuitNights, lastNight], null, NOW);
    const cmp = trends.vsBaseline.find((c) => c.metric === 'snoreBurden');
    expect(cmp?.deltaPercent).toBe(-27);
  });
});

describe('computeSnoreTrends — nightSeries', () => {
  it('is chronological (by epoch, not string comparison) across mixed timezone offsets', () => {
    // Same UTC-instant relationship is deliberately obscured by string
    // comparison: this string is LEXICALLY greater ('...T23...') yet its
    // instant (14:00 UTC) is EARLIER than the second night's (15:00 UTC).
    const earlierByEpoch = night('2024-01-01T23:00:00+09:00', { snoreBurden: 1 }); // 14:00 UTC
    const laterByEpoch = night('2024-01-01T10:00:00-05:00', { snoreBurden: 2 }); // 15:00 UTC
    const trends = computeSnoreTrends([laterByEpoch, earlierByEpoch], null, new Date('2024-01-02T00:00:00Z'));
    expect(trends.nightSeries.map((n) => n.snoreBurden)).toEqual([1, 2]);
  });

  it('includes all analyzable nights chronologically with snoreBurden and eventsPerHour', () => {
    const n1 = night(daysAgo(3), { snoreBurden: 10, eventsPerHour: 1.5 });
    const n2 = night(daysAgo(1), { snoreBurden: 30, eventsPerHour: 3.5 });
    const n3 = night(daysAgo(2), { snoreBurden: 20, eventsPerHour: 2.5 });
    const trends = computeSnoreTrends([n1, n2, n3], null, NOW);
    expect(trends.nightSeries).toEqual([
      { startedAt: n1.startedAt, snoreBurden: 10, eventsPerHour: 1.5 },
      { startedAt: n3.startedAt, snoreBurden: 20, eventsPerHour: 2.5 },
      { startedAt: n2.startedAt, snoreBurden: 30, eventsPerHour: 3.5 },
    ]);
  });
});

describe('computeSnoreTrends — mixed analysisVersion (documented limitation)', () => {
  it('compares nights across different analysisVersion values as-is', () => {
    const preQuitNights = Array.from({ length: MIN_NIGHTS_PRE_QUIT }, (_, i) =>
      night(daysAgo(90 - i), { snoreBurden: 40 }, { preQuit: true, analysisVersion: 'ts-0.9.0' })
    );
    const lastNight = night(daysAgo(1), { snoreBurden: 60 }, { analysisVersion: 'ts-1.0.0' });
    const trends = computeSnoreTrends([...preQuitNights, lastNight], null, NOW);
    expect(trends.analyzableNights).toBe(MIN_NIGHTS_PRE_QUIT + 1);
    const cmp = trends.vsBaseline.find((c) => c.metric === 'snoreBurden');
    expect(cmp?.current).toBe(60);
    expect(cmp?.reference).toBe(40);
  });
});

describe('computeSnoreTrends — baseline means', () => {
  it('computes the plain arithmetic mean per metric over the bucket', () => {
    // Integer values throughout (including avgIntensity, which is normally
    // 0..1 but the domain type is just `number`) to divide evenly and avoid
    // float-precision noise in the assertion; the implementation itself
    // does no rounding.
    const sessions = [
      night(daysAgo(1), { snoreDurationMs: 1000, eventsPerHour: 1, avgIntensity: 10, snoreBurden: 10 }),
      night(daysAgo(2), { snoreDurationMs: 2000, eventsPerHour: 2, avgIntensity: 20, snoreBurden: 20 }),
      night(daysAgo(3), { snoreDurationMs: 3000, eventsPerHour: 3, avgIntensity: 30, snoreBurden: 30 }),
    ];
    const trends = computeSnoreTrends(sessions, null, NOW);
    expect(trends.sevenNightAvg?.means).toEqual({
      snoreDurationMs: 2000,
      eventsPerHour: 2,
      avgIntensity: 20,
      snoreBurden: 20,
    });
  });
});
