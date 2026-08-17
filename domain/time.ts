/**
 * Pure time/date utilities for the quit-smoking app.
 *
 * Every function takes explicit `Date`/string inputs — nothing in this
 * module calls `Date.now()` or constructs an argless `new Date()`. Callers
 * (React components, hooks) are responsible for supplying "now".
 */

import type { Duration } from './types';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const EIGHT_WEEKS_MS = 56 * DAY_MS;
const DAYS_PER_MONTH = 30.44;
const DAYS_PER_YEAR = 365.25;
const YEAR_MS = DAYS_PER_YEAR * DAY_MS;

export function durationBetween(from: Date, to: Date): Duration {
  const totalMs = Math.max(0, to.getTime() - from.getTime());
  const days = Math.floor(totalMs / DAY_MS);
  const hours = Math.floor((totalMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((totalMs % HOUR_MS) / MINUTE_MS);
  const seconds = Math.floor((totalMs % MINUTE_MS) / 1000);
  return { totalMs, days, hours, minutes, seconds };
}

export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / HOUR_MS;
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** ISO week: Monday 00:00 local. */
export function startOfLocalWeek(d: Date): Date {
  const start = startOfLocalDay(d);
  const day = start.getDay(); // 0 = Sun .. 6 = Sat
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysSinceMonday);
  return start;
}

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

/**
 * Parses the ISO string's OWN offset: returns the wall-clock hour at the
 * place/time the event happened, NOT the current device timezone's hour.
 * ISO 8601 local date-time components already represent the wall clock at
 * whatever offset (or lack thereof) is present, so the hour is simply the
 * literal HH field of the string ('Z', '+HH:MM', '-HH:MM', and no-offset are
 * all supported this way). Throws on input that isn't a conforming ISO
 * date-time string — callers must not rely on ambient/device timezone
 * conversion here, so silently falling back to `new Date(iso).getHours()`
 * (which is device-timezone-dependent) is deliberately not supported.
 */
export function localHourOf(iso: string): number {
  const match = ISO_WITH_OFFSET.exec(iso);
  if (!match) {
    throw new Error(`localHourOf: not a conforming ISO date-time string: ${iso}`);
  }
  return Number(match[1]);
}

/** ISO week key (e.g. '2026-W34'), computed from device-local Y/M/D. */
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon = 0 .. Sun = 6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Thursday of this ISO week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / WEEK_MS);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export type DurationStyle = 'compact';

/**
 * Adaptive, locale-independent-English formatting of "time smoke-free".
 * See task brief for the exact band boundaries and rounding rules.
 */
export function formatSmokeFreeDuration(
  quitAt: Date,
  now: Date
): { primary: string; secondary?: string } {
  const ms = Math.max(0, now.getTime() - quitAt.getTime());

  if (ms < HOUR_MS) {
    const minutes = Math.floor(ms / MINUTE_MS);
    return { primary: pluralize(minutes, 'minute') };
  }

  if (ms < DAY_MS) {
    const hours = Math.floor(ms / HOUR_MS);
    const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
    return { primary: `${hours}h ${minutes}m` };
  }

  if (ms < WEEK_MS) {
    const days = Math.floor(ms / DAY_MS);
    const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
    const minutes = Math.floor((ms % HOUR_MS) / MINUTE_MS);
    return { primary: `${days}d ${hours}h ${minutes}m` };
  }

  if (ms < EIGHT_WEEKS_MS) {
    const totalDays = Math.floor(ms / DAY_MS);
    const weeks = Math.floor(totalDays / 7);
    const remainderDays = totalDays % 7;
    const hoursRemainder = Math.floor((ms % DAY_MS) / HOUR_MS);
    const primary =
      remainderDays === 0
        ? pluralize(weeks, 'week')
        : `${pluralize(weeks, 'week')}, ${pluralize(remainderDays, 'day')}`;
    return { primary, secondary: `${totalDays}d ${hoursRemainder}h` };
  }

  if (ms < YEAR_MS) {
    const totalDaysFloat = ms / DAY_MS;
    const months = Math.floor(totalDaysFloat / DAYS_PER_MONTH);
    const remainderDays = totalDaysFloat - months * DAYS_PER_MONTH;
    const weeks = Math.round(remainderDays / 7);
    const primary =
      weeks === 0
        ? pluralize(months, 'month')
        : `${pluralize(months, 'month')}, ${pluralize(weeks, 'week')}`;
    return { primary };
  }

  const totalDaysFloat = ms / DAY_MS;
  const years = Math.floor(totalDaysFloat / DAYS_PER_YEAR);
  const remainderDays = totalDaysFloat - years * DAYS_PER_YEAR;
  const months = Math.round(remainderDays / DAYS_PER_MONTH);
  const primary =
    months === 0
      ? pluralize(years, 'year')
      : `${pluralize(years, 'year')}, ${pluralize(months, 'month')}`;
  return { primary };
}

/** 'D:HH:MM:SS' when >= 1 day, else 'HH:MM:SS'. For the tap-to-reveal precise timer. */
export function formatDurationDigital(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days >= 1) {
    return `${days}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
