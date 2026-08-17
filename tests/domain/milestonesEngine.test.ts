import { describe, expect, it } from 'vitest';
import type { HealthMilestone } from '@/domain/types';
import {
  TIME_BANDS,
  bandOf,
  categoryProgress,
  computeMilestoneStates,
  currentBandId,
  graceWindowHours,
  groupByTimeBand,
  happeningNow,
  milestoneState,
  nextMilestone,
  recentlyAchieved,
  upcomingSoon,
  type MilestoneState,
} from '@/domain/milestones/engine';

const HOUR = 3_600_000;
const at = (hours: number) => new Date(hours * HOUR);
const EPOCH = new Date(0);

function fixture(
  id: string,
  category: HealthMilestone['category'],
  timing: HealthMilestone['timing']
): HealthMilestone {
  return {
    id,
    category,
    title: `title-${id}`,
    description: `description-${id}`,
    timing,
    evidenceLevel: 'moderate',
    sources: [{ label: 'src', url: 'https://example.com' }],
  };
}

const windowM = fixture('w1', 'heart', {
  kind: 'window',
  earliestHours: 10,
  typicalUntilHours: 20,
});
const pointM = fixture('p1', 'lungs', { kind: 'point', earliestHours: 8 });
const openEndedM = fixture('o1', 'brain', {
  kind: 'openEnded',
  earliestHours: 24,
});
const noTimelineM = fixture('n1', 'freedom', {
  kind: 'noTimeline',
  phrase: 'whenever it happens',
});

describe('graceWindowHours', () => {
  it('a 20-minute milestone gets a 2-hour grace (floor, not half of a tiny number)', () => {
    expect(graceWindowHours(1 / 3)).toBe(2);
  });

  it('an 8766-hour milestone gets half its earliest as grace (4383h)', () => {
    expect(graceWindowHours(8766)).toBe(4383);
  });
});

describe('milestoneState — window timing', () => {
  it('before earliest: upcoming with startsInMs to earliest', () => {
    const s = milestoneState(windowM, EPOCH, at(5));
    expect(s.status).toBe('upcoming');
    expect(s.startsInMs).toBe(5 * HOUR);
    expect(s.progress).toBeUndefined();
  });

  it('exactly at earliest: happening-now with progress 0', () => {
    const s = milestoneState(windowM, EPOCH, at(10));
    expect(s.status).toBe('happening-now');
    expect(s.progress).toBe(0);
  });

  it('midpoint: happening-now with progress 0.5', () => {
    const s = milestoneState(windowM, EPOCH, at(15));
    expect(s.status).toBe('happening-now');
    expect(s.progress).toBeCloseTo(0.5, 10);
  });

  it('exactly at typicalUntil: happening-now with progress 1 (inclusive boundary)', () => {
    const s = milestoneState(windowM, EPOCH, at(20));
    expect(s.status).toBe('happening-now');
    expect(s.progress).toBe(1);
  });

  it('past typicalUntil: achieved, achievedForMs measured from typicalUntil', () => {
    const s = milestoneState(windowM, EPOCH, at(25));
    expect(s.status).toBe('achieved');
    expect(s.achievedForMs).toBe(5 * HOUR);
    expect(s.progress).toBeUndefined();
  });
});

describe('milestoneState — degenerate window (typicalUntil <= earliest) falls back to point behavior', () => {
  // earliestHours === typicalUntilHours: no division should ever happen.
  const equalBounds = fixture('deg-equal', 'heart', {
    kind: 'window',
    earliestHours: 10,
    typicalUntilHours: 10,
  });
  // typicalUntilHours < earliestHours: malformed the other way.
  const invertedBounds = fixture('deg-inverted', 'heart', {
    kind: 'window',
    earliestHours: 10,
    typicalUntilHours: 5,
  });

  it.each([
    ['equal bounds', equalBounds],
    ['inverted bounds', invertedBounds],
  ])('%s: before earliest is upcoming, never NaN', (_label, m) => {
    const s = milestoneState(m, EPOCH, at(9));
    expect(s.status).toBe('upcoming');
    expect(s.startsInMs).toBe(1 * HOUR);
    expect(s.progress).toBeUndefined();
    expect(Number.isNaN(s.progress)).toBe(false);
  });

  it.each([
    ['equal bounds', equalBounds],
    ['inverted bounds', invertedBounds],
  ])('%s: at earliest is happening-now with no progress (point-style)', (_label, m) => {
    const s = milestoneState(m, EPOCH, at(10));
    expect(s.status).toBe('happening-now');
    expect(s.progress).toBeUndefined();
  });

  it.each([
    ['equal bounds', equalBounds],
    ['inverted bounds', invertedBounds],
  ])('%s: at the grace edge (earliest + grace = 15) is still happening-now', (_label, m) => {
    // grace = max(10*0.5, 2) = 5 -> boundary at 15
    const s = milestoneState(m, EPOCH, at(15));
    expect(s.status).toBe('happening-now');
  });

  it.each([
    ['equal bounds', equalBounds],
    ['inverted bounds', invertedBounds],
  ])(
    '%s: past the grace edge is achieved, achievedForMs measured from earliestHours',
    (_label, m) => {
      const s = milestoneState(m, EPOCH, at(16));
      expect(s.status).toBe('achieved');
      expect(s.achievedForMs).toBe(6 * HOUR);
      expect(Number.isNaN(s.achievedForMs)).toBe(false);
    }
  );
});

describe('milestoneState — point timing', () => {
  it('before earliest: upcoming with startsInMs to earliest', () => {
    const s = milestoneState(pointM, EPOCH, at(7));
    expect(s.status).toBe('upcoming');
    expect(s.startsInMs).toBe(1 * HOUR);
  });

  it('exactly at earliest: happening-now, no progress', () => {
    const s = milestoneState(pointM, EPOCH, at(8));
    expect(s.status).toBe('happening-now');
    expect(s.progress).toBeUndefined();
  });

  it('exactly at the grace edge (earliest + grace): still happening-now', () => {
    // grace = max(8*0.5, 2) = 4 -> boundary at 12
    const s = milestoneState(pointM, EPOCH, at(12));
    expect(s.status).toBe('happening-now');
  });

  it('past the grace edge: achieved, achievedForMs measured from earliestHours', () => {
    const s = milestoneState(pointM, EPOCH, at(13));
    expect(s.status).toBe('achieved');
    expect(s.achievedForMs).toBe(5 * HOUR);
  });
});

describe('milestoneState — openEnded timing', () => {
  it('before earliest: upcoming', () => {
    const s = milestoneState(openEndedM, EPOCH, at(23));
    expect(s.status).toBe('upcoming');
    expect(s.startsInMs).toBe(1 * HOUR);
  });

  it('exactly at earliest: achieved, stillImproving, achievedForMs 0', () => {
    const s = milestoneState(openEndedM, EPOCH, at(24));
    expect(s.status).toBe('achieved');
    expect(s.stillImproving).toBe(true);
    expect(s.achievedForMs).toBe(0);
  });

  it('well past earliest: achieved with achievedForMs from earliestHours', () => {
    const s = milestoneState(openEndedM, EPOCH, at(30));
    expect(s.status).toBe('achieved');
    expect(s.stillImproving).toBe(true);
    expect(s.achievedForMs).toBe(6 * HOUR);
  });
});

describe('milestoneState — noTimeline timing', () => {
  it('is always no-timeline, regardless of elapsed sign', () => {
    expect(milestoneState(noTimelineM, EPOCH, at(100)).status).toBe(
      'no-timeline'
    );
    expect(milestoneState(noTimelineM, EPOCH, at(-100)).status).toBe(
      'no-timeline'
    );
  });
});

describe('milestoneState — negative elapsed (pre-quit)', () => {
  const now = at(-5); // quit is 5 hours in the future relative to "now"

  it('window: upcoming with startsInMs counted from now to earliest', () => {
    const s = milestoneState(windowM, EPOCH, now);
    expect(s.status).toBe('upcoming');
    expect(s.startsInMs).toBe(15 * HOUR);
  });

  it('point: upcoming with startsInMs counted from now to earliest', () => {
    const s = milestoneState(pointM, EPOCH, now);
    expect(s.status).toBe('upcoming');
    expect(s.startsInMs).toBe(13 * HOUR);
  });

  it('openEnded: upcoming with startsInMs counted from now to earliest', () => {
    const s = milestoneState(openEndedM, EPOCH, now);
    expect(s.status).toBe('upcoming');
    expect(s.startsInMs).toBe(29 * HOUR);
  });

  it('noTimeline: still no-timeline', () => {
    expect(milestoneState(noTimelineM, EPOCH, now).status).toBe('no-timeline');
  });
});

describe('computeMilestoneStates', () => {
  it('maps every milestone to its state, preserving order', () => {
    const all = [windowM, pointM, openEndedM, noTimelineM];
    const states = computeMilestoneStates(all, EPOCH, at(9));
    expect(states.map((s) => s.milestone.id)).toEqual([
      'w1',
      'p1',
      'o1',
      'n1',
    ]);
    expect(states[0].status).toBe('upcoming'); // window, e=9 < 10
    expect(states[1].status).toBe('happening-now'); // point, e=9 in [8,12]
    expect(states[2].status).toBe('upcoming'); // openEnded, e=9 < 24
    expect(states[3].status).toBe('no-timeline');
  });
});

describe('happeningNow', () => {
  it('orders window milestones by ascending progress (freshest first), then points by earliestHours desc', () => {
    const windowA = fixture('wa', 'heart', {
      kind: 'window',
      earliestHours: 0,
      typicalUntilHours: 10,
    }); // e=5 -> progress 0.5
    const windowB = fixture('wb', 'heart', {
      kind: 'window',
      earliestHours: 0,
      typicalUntilHours: 20,
    }); // e=5 -> progress 0.25
    const windowC = fixture('wc', 'heart', {
      kind: 'window',
      earliestHours: 0,
      typicalUntilHours: 100,
    }); // e=5 -> progress 0.05
    const pointX = fixture('px', 'lungs', { kind: 'point', earliestHours: 5 }); // grace 2.5, boundary 7.5
    const pointY = fixture('py', 'lungs', {
      kind: 'point',
      earliestHours: 4.5,
    }); // grace 2.25, boundary 6.75

    const all = [windowA, windowB, windowC, pointX, pointY];
    const states = computeMilestoneStates(all, EPOCH, at(5));
    const result = happeningNow(states);

    expect(result.map((s) => s.milestone.id)).toEqual([
      'wc',
      'wb',
      'wa',
      'px',
      'py',
    ]);
  });

  it('returns empty when nothing is achieved or happening-now yet (pre-quit)', () => {
    const all = [windowM, pointM, openEndedM, noTimelineM];
    const states = computeMilestoneStates(all, EPOCH, at(-5));
    expect(happeningNow(states)).toEqual([]);
  });

  it('falls back to the single most-recently-achieved dated milestone when none are active (e.g. a 20-year-old quit)', () => {
    // boundaries: windowM -> 20h, pointM -> 12h, openEndedM -> 24h.
    // At a huge elapsed, all three are achieved; openEndedM's boundary (24h)
    // is the largest, so it is the most recently crossed.
    const all = [windowM, pointM, openEndedM, noTimelineM];
    const states = computeMilestoneStates(all, EPOCH, at(200_000));
    const result = happeningNow(states);
    expect(result).toHaveLength(1);
    expect(result[0].milestone.id).toBe('o1');
  });

  it('treats a happening-now degenerate window (typicalUntil <= earliest) as point-like for ordering', () => {
    const realWindow = fixture('rw', 'heart', {
      kind: 'window',
      earliestHours: 0,
      typicalUntilHours: 10,
    }); // e=5 -> progress 0.5, happening-now
    const degenerate = fixture('deg', 'lungs', {
      kind: 'window',
      earliestHours: 5,
      typicalUntilHours: 5,
    }); // grace = max(2.5,2)=2.5, boundary 7.5; e=5 -> happening-now, point-style (no progress)

    const states = computeMilestoneStates([realWindow, degenerate], EPOCH, at(5));
    const result = happeningNow(states);

    // The degenerate one must NOT be sorted among "windows" by an undefined
    // progress (which would silently coerce to 0) — it belongs in the
    // points bucket, after the real window.
    expect(result.map((s) => s.milestone.id)).toEqual(['rw', 'deg']);
  });

  it('fallback ranking for an achieved degenerate window uses earliestHours as its boundary (matches its achievedForMs anchor)', () => {
    const degenerate = fixture('deg-achieved', 'lungs', {
      kind: 'window',
      earliestHours: 10,
      typicalUntilHours: 10,
    }); // grace 5, happening-now until e=15; achievedForMs anchor/boundary = earliestHours = 10
    const otherAchieved = fixture('other-achieved', 'heart', {
      kind: 'point',
      earliestHours: 14,
    }); // grace 7, happening-now until e=21; boundary = earliestHours = 14 (> degenerate's 10)

    const states = computeMilestoneStates([degenerate, otherAchieved], EPOCH, at(50));
    const result = happeningNow(states);

    // otherAchieved's boundary (14) is more recent than degenerate's (10),
    // so it — not the degenerate window — is the fallback pick.
    expect(result).toHaveLength(1);
    expect(result[0].milestone.id).toBe('other-achieved');
  });
});

describe('nextMilestone', () => {
  const all = [windowM, pointM, openEndedM, noTimelineM];

  it('returns the dated milestone with the smallest earliestHours strictly greater than elapsed', () => {
    const states = computeMilestoneStates(all, EPOCH, at(9));
    const result = nextMilestone(states, EPOCH, at(9));
    expect(result).not.toBeNull();
    expect(result?.state.milestone.id).toBe('w1');
    expect(result?.etaMs).toBe(1 * HOUR);
  });

  it('returns null when no dated milestone remains ahead', () => {
    const states = computeMilestoneStates(all, EPOCH, at(25));
    expect(nextMilestone(states, EPOCH, at(25))).toBeNull();
  });
});

describe('recentlyAchieved', () => {
  it('sorts achieved states by achievedForMs ascending (most recent first) and limits', () => {
    const all = [windowM, pointM, openEndedM, noTimelineM];
    const states = computeMilestoneStates(all, EPOCH, at(50));
    const result = recentlyAchieved(states, 2);
    expect(result.map((s) => s.milestone.id)).toEqual(['o1', 'w1']);
  });
});

describe('upcomingSoon', () => {
  it('sorts upcoming states by startsInMs ascending and limits', () => {
    const all = [windowM, pointM, openEndedM, noTimelineM];
    const states = computeMilestoneStates(all, EPOCH, at(0));
    const result = upcomingSoon(states, 2);
    expect(result.map((s) => s.milestone.id)).toEqual(['p1', 'w1']);
  });
});

describe('bandOf', () => {
  it('places an earliestHours of 1 in the first-20-minutes band (inclusive upper edge)', () => {
    const m = fixture('b1', 'heart', { kind: 'point', earliestHours: 1 });
    expect(bandOf(m)).toBe('first-20-minutes');
  });

  it('places an earliestHours just past 1 into first-day', () => {
    const m = fixture('b2', 'heart', { kind: 'point', earliestHours: 1.5 });
    expect(bandOf(m)).toBe('first-day');
  });

  it('places an earliestHours of exactly 24 in first-day (inclusive upper edge)', () => {
    const m = fixture('b3', 'heart', { kind: 'point', earliestHours: 24 });
    expect(bandOf(m)).toBe('first-day');
  });

  it('places an earliestHours just past 24 into days-2-3', () => {
    const m = fixture('b4', 'heart', { kind: 'point', earliestHours: 24.5 });
    expect(bandOf(m)).toBe('days-2-3');
  });

  it('places a huge earliestHours in the final open-ended band', () => {
    const m = fixture('b5', 'heart', {
      kind: 'point',
      earliestHours: 1_000_000,
    });
    expect(bandOf(m)).toBe('beyond-15-years');
  });

  it('returns null for noTimeline milestones', () => {
    expect(bandOf(noTimelineM)).toBeNull();
  });
});

describe('groupByTimeBand', () => {
  it('groups dated milestones in band order, sorts within a band by earliestHours, omits empty bands and noTimeline', () => {
    const early = fixture('early', 'heart', {
      kind: 'point',
      earliestHours: 0.5,
    }); // first-20-minutes
    const dayLate = fixture('day-late', 'heart', {
      kind: 'point',
      earliestHours: 5,
    }); // first-day
    const dayEarly = fixture('day-early', 'heart', {
      kind: 'point',
      earliestHours: 2,
    }); // first-day
    const days23 = fixture('days23', 'heart', {
      kind: 'point',
      earliestHours: 50,
    }); // days-2-3

    const states: MilestoneState[] = [
      early,
      dayLate,
      dayEarly,
      days23,
      noTimelineM,
    ].map((m) => ({ milestone: m, status: 'upcoming' as const }));

    const groups = groupByTimeBand(states);

    expect(groups.map((g) => g.band.id)).toEqual([
      'first-20-minutes',
      'first-day',
      'days-2-3',
    ]);
    expect(groups[0].states.map((s) => s.milestone.id)).toEqual(['early']);
    expect(groups[1].states.map((s) => s.milestone.id)).toEqual([
      'day-early',
      'day-late',
    ]);
    expect(groups[2].states.map((s) => s.milestone.id)).toEqual(['days23']);
  });
});

describe('currentBandId', () => {
  it('at elapsed 1h: first-20-minutes (inclusive edge)', () => {
    expect(currentBandId(EPOCH, at(1))).toBe('first-20-minutes');
  });

  it('at elapsed 1.5h: first-day', () => {
    expect(currentBandId(EPOCH, at(1.5))).toBe('first-day');
  });

  it('at elapsed exactly 24h: first-day (inclusive edge)', () => {
    expect(currentBandId(EPOCH, at(24))).toBe('first-day');
  });

  it('at elapsed just past 24h: days-2-3', () => {
    expect(currentBandId(EPOCH, at(24.5))).toBe('days-2-3');
  });

  it('pre-quit (negative elapsed): first-20-minutes', () => {
    expect(currentBandId(EPOCH, at(-5))).toBe('first-20-minutes');
  });

  it('a very old quit: beyond-15-years', () => {
    expect(currentBandId(EPOCH, at(200_000))).toBe('beyond-15-years');
  });
});

describe('TIME_BANDS', () => {
  it('is ordered ascending by untilHours', () => {
    for (let i = 1; i < TIME_BANDS.length; i++) {
      expect(TIME_BANDS[i].untilHours).toBeGreaterThan(
        TIME_BANDS[i - 1].untilHours
      );
    }
  });
});

describe('categoryProgress', () => {
  it('counts total (including noTimeline) per category, and achieved/happeningNow only for dated ones', () => {
    const heartAchieved = fixture('h-achieved', 'heart', {
      kind: 'point',
      earliestHours: 1,
    });
    const heartHappening = fixture('h-happening', 'heart', {
      kind: 'window',
      earliestHours: 0,
      typicalUntilHours: 10,
    });
    const heartNoTimeline = fixture('h-none', 'heart', {
      kind: 'noTimeline',
      phrase: 'eventually',
    });
    const lungsUpcoming = fixture('l-upcoming', 'lungs', {
      kind: 'point',
      earliestHours: 50,
    });

    const all = [
      heartAchieved,
      heartHappening,
      heartNoTimeline,
      lungsUpcoming,
    ];
    const states = computeMilestoneStates(all, EPOCH, at(5));
    const result = categoryProgress(states);

    expect(result.heart).toEqual({ achieved: 1, happeningNow: 1, total: 3 });
    expect(result.lungs).toEqual({ achieved: 0, happeningNow: 0, total: 1 });
    expect(result.brain).toBeUndefined();
  });
});
