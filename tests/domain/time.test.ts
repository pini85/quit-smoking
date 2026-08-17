import { describe, expect, it } from 'vitest';
import {
  durationBetween,
  hoursBetween,
  startOfLocalDay,
  startOfLocalWeek,
  localHourOf,
  isoWeekKey,
  formatSmokeFreeDuration,
  formatDurationDigital,
} from '@/domain/time';

describe('durationBetween', () => {
  it('splits a positive difference into days/hours/minutes/seconds', () => {
    const from = new Date(2026, 0, 1, 0, 0, 0);
    const to = new Date(2026, 0, 4, 5, 12, 34);
    const d = durationBetween(from, to);
    expect(d).toEqual({
      totalMs: to.getTime() - from.getTime(),
      days: 3,
      hours: 5,
      minutes: 12,
      seconds: 34,
    });
  });

  it('clamps a negative difference to zero (never negative components)', () => {
    const from = new Date(2026, 0, 4, 0, 0, 0);
    const to = new Date(2026, 0, 1, 0, 0, 0);
    const d = durationBetween(from, to);
    expect(d).toEqual({ totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it('returns zero components for identical instants', () => {
    const at = new Date(2026, 0, 1, 12, 0, 0);
    expect(durationBetween(at, at)).toEqual({
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });
});

describe('hoursBetween', () => {
  it('returns a fractional number of hours', () => {
    const from = new Date(2026, 0, 1, 0, 0, 0);
    const to = new Date(2026, 0, 1, 1, 30, 0);
    expect(hoursBetween(from, to)).toBeCloseTo(1.5, 10);
  });
});

describe('startOfLocalDay', () => {
  it('truncates to local midnight', () => {
    const d = new Date(2026, 7, 17, 21, 45, 30, 123);
    const result = startOfLocalDay(d);
    expect(result).toEqual(new Date(2026, 7, 17, 0, 0, 0, 0));
  });
});

describe('startOfLocalWeek', () => {
  it('on a Sunday returns the previous Monday at local midnight', () => {
    // 2026-08-16 is a Sunday.
    const sunday = new Date(2026, 7, 16, 15, 0, 0);
    const result = startOfLocalWeek(sunday);
    expect(result).toEqual(new Date(2026, 7, 10, 0, 0, 0, 0));
  });

  it('on a Monday returns that same day at local midnight', () => {
    // 2026-08-17 is a Monday.
    const monday = new Date(2026, 7, 17, 9, 30, 0);
    const result = startOfLocalWeek(monday);
    expect(result).toEqual(new Date(2026, 7, 17, 0, 0, 0, 0));
  });
});

describe('localHourOf', () => {
  it('reads the wall-clock hour for a Z (UTC) offset', () => {
    expect(localHourOf('2026-08-17T21:30:00Z')).toBe(21);
  });

  it('reads the wall-clock hour for a +HH:MM offset, ignoring device tz', () => {
    expect(localHourOf('2026-08-17T21:30:00+03:00')).toBe(21);
  });

  it('reads the wall-clock hour for a -HH:MM offset, ignoring device tz', () => {
    expect(localHourOf('2026-08-17T21:30:00-05:30')).toBe(21);
  });

  it('treats a string with no offset as already local (reads the literal hour)', () => {
    expect(localHourOf('2026-08-17T21:30:00')).toBe(21);
  });

  it('throws on a non-conforming ISO date-time string', () => {
    expect(() => localHourOf('not-a-date')).toThrow(
      /not a conforming ISO date-time string/
    );
  });

  it('throws rather than silently falling back to device-timezone parsing', () => {
    // A date-only string (no time component) is not a conforming
    // date-time string for this function's contract.
    expect(() => localHourOf('2026-08-17')).toThrow();
  });
});

describe('isoWeekKey', () => {
  it('formats a mid-year local date', () => {
    // 2026-08-17 is a Monday in ISO week 34.
    expect(isoWeekKey(new Date(2026, 7, 17, 12, 0, 0))).toBe('2026-W34');
  });

  it('handles the ISO year-boundary: 2025-12-29 belongs to 2026-W01', () => {
    expect(isoWeekKey(new Date(2025, 11, 29, 12, 0, 0))).toBe('2026-W01');
  });

  it('the day before the boundary is still in the old ISO year (2025-W52)', () => {
    expect(isoWeekKey(new Date(2025, 11, 28, 12, 0, 0))).toBe('2025-W52');
  });

  it('2026-01-01 (a Thursday) belongs to 2026-W01', () => {
    expect(isoWeekKey(new Date(2026, 0, 1, 12, 0, 0))).toBe('2026-W01');
  });
});

describe('formatSmokeFreeDuration', () => {
  const at = (ms: number) => ({
    quitAt: new Date(0),
    now: new Date(ms),
  });

  it('< 1h: shows plural minutes', () => {
    const { quitAt, now } = at(47 * 60_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '47 minutes' });
  });

  it('< 1h: singular minute', () => {
    const { quitAt, now } = at(1 * 60_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '1 minute' });
  });

  it('boundary: exactly 1h moves into the hours/minutes band', () => {
    const { quitAt, now } = at(1 * 3_600_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '1h 0m' });
  });

  it('< 24h: hours and minutes', () => {
    const { quitAt, now } = at(16 * 3_600_000 + 42 * 60_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '16h 42m' });
  });

  it('boundary: exactly 24h moves into the days band', () => {
    const { quitAt, now } = at(24 * 3_600_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '1d 0h 0m' });
  });

  it('1-7 days: days, hours, minutes', () => {
    const { quitAt, now } = at(6 * 86_400_000 + 4 * 3_600_000 + 32 * 60_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '6d 4h 32m' });
  });

  it('boundary: exactly 7d moves into the weeks band, singular week', () => {
    const { quitAt, now } = at(7 * 86_400_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({
      primary: '1 week',
      secondary: '7d 0h',
    });
  });

  it('7d-8wk: singular week and singular day', () => {
    const { quitAt, now } = at(8 * 86_400_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({
      primary: '1 week, 1 day',
      secondary: '8d 0h',
    });
  });

  it('7d-8wk: plural weeks and days, with secondary precise breakdown', () => {
    const { quitAt, now } = at(18 * 86_400_000 + 6 * 3_600_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({
      primary: '2 weeks, 4 days',
      secondary: '18d 6h',
    });
  });

  it('7d-8wk: zero-value second unit (days) is dropped', () => {
    const { quitAt, now } = at(14 * 86_400_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({
      primary: '2 weeks',
      secondary: '14d 0h',
    });
  });

  it('boundary: exactly 8 weeks moves into the months band', () => {
    const { quitAt, now } = at(56 * 86_400_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '1 month, 4 weeks' });
  });

  it('8wk-1y: months and weeks (plural)', () => {
    const { quitAt, now } = at(8_494_848_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '3 months, 1 week' });
  });

  it('8wk-1y: singular week', () => {
    const { quitAt, now } = at(5_864_832_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '2 months, 1 week' });
  });

  it('8wk-1y: zero-value second unit (weeks) is dropped', () => {
    const { quitAt, now } = at(5_260_032_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '2 months' });
  });

  it('boundary: exactly 1 year moves into the years band, dropping zero months', () => {
    const { quitAt, now } = at(31_557_600_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '1 year' });
  });

  it('>= 1y: years and months (plural)', () => {
    const { quitAt, now } = at(36_817_632_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '1 year, 2 months' });
  });

  it('>= 1y: singular month', () => {
    const { quitAt, now } = at(34_187_616_000);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '1 year, 1 month' });
  });

  it('clamps a negative span to zero (now before quitAt)', () => {
    const quitAt = new Date(10_000);
    const now = new Date(0);
    expect(formatSmokeFreeDuration(quitAt, now)).toEqual({ primary: '0 minutes' });
  });
});

describe('formatDurationDigital', () => {
  it('formats sub-day durations as HH:MM:SS', () => {
    const ms = 3 * 3_600_000 + 4 * 60_000 + 5 * 1000;
    expect(formatDurationDigital(ms)).toBe('03:04:05');
  });

  it('formats multi-day durations as D:HH:MM:SS', () => {
    const ms = 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5 * 1000;
    expect(formatDurationDigital(ms)).toBe('2:03:04:05');
  });

  it('rounds down partial seconds', () => {
    expect(formatDurationDigital(1_999)).toBe('00:00:01');
  });
});
