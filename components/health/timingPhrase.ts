import type { MilestoneTiming } from '@/domain/types';

/**
 * Turns a `MilestoneTiming` into the honest, human sentence fragment used
 * throughout the health screens ("typically 20 minutes after quitting").
 * Pure — no clock access, no formatting precision the dataset doesn't
 * actually support.
 */

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const HOURS_PER_DAY = 24;
const HOURS_PER_WEEK = HOURS_PER_DAY * 7;
const HOURS_PER_MONTH = 730; // ~30.4 days — coarse on purpose, see module doc.
const HOURS_PER_YEAR = 8766; // 365.25 days, matches domain/milestones/engine's TIME_BANDS.

/**
 * Coarse, locale-independent-English duration formatting. Deliberately
 * imprecise: the underlying timings are themselves approximations, so a
 * to-the-minute figure would claim more precision than the evidence has.
 */
export function fmt(hours: number): string {
  const safe = Math.max(0, hours);

  if (safe < 1) return pluralize(Math.round(safe * 60), 'minute');
  if (safe < 48) return pluralize(Math.round(safe), 'hour');
  if (safe < 14 * HOURS_PER_DAY) return pluralize(Math.round(safe / HOURS_PER_DAY), 'day');
  if (safe < 9 * HOURS_PER_WEEK) return pluralize(Math.round(safe / HOURS_PER_WEEK), 'week');
  if (safe < 24 * HOURS_PER_MONTH) return pluralize(Math.round(safe / HOURS_PER_MONTH), 'month');
  return pluralize(Math.round(safe / HOURS_PER_YEAR), 'year');
}

/**
 * "typically X after quitting" phrasing for a milestone's timing. Never
 * invents a day number the evidence doesn't support — a `noTimeline` timing
 * is returned verbatim, exactly as the dataset wrote it.
 */
export function timingPhrase(t: MilestoneTiming): string {
  switch (t.kind) {
    case 'window':
      return `typically ${fmt(t.earliestHours)}–${fmt(t.typicalUntilHours)} after quitting`;
    case 'point':
      return `around ${fmt(t.earliestHours)} after quitting`;
    case 'openEnded':
      return `from ${fmt(t.earliestHours)} on — and continuing`;
    case 'noTimeline':
      return t.phrase;
  }
}

export default timingPhrase;
