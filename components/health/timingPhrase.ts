import type { Locale, MilestoneTiming } from '@/domain/types';
import { formatCount, formatCountFrom, type DurationUnit } from '@/domain/i18n/units';

/**
 * Turns a `MilestoneTiming` into the honest, human sentence fragment used
 * throughout the health screens ("typically 20 minutes after quitting").
 * Pure — no clock access, no formatting precision the dataset doesn't
 * actually support.
 */

const HOURS_PER_DAY = 24;
const HOURS_PER_WEEK = HOURS_PER_DAY * 7;
const HOURS_PER_MONTH = 730; // ~30.4 days — coarse on purpose, see module doc.
const HOURS_PER_YEAR = 8766; // 365.25 days, matches domain/milestones/engine's TIME_BANDS.

/**
 * Coarse banding shared by every phrasing below. Deliberately imprecise: the
 * underlying timings are themselves approximations, so a to-the-minute
 * figure would claim more precision than the evidence has.
 */
function coarse(hours: number): { n: number; unit: DurationUnit } {
  const safe = Math.max(0, hours);

  if (safe < 1) return { n: Math.round(safe * 60), unit: 'minute' };
  if (safe < 48) return { n: Math.round(safe), unit: 'hour' };
  if (safe < 14 * HOURS_PER_DAY) return { n: Math.round(safe / HOURS_PER_DAY), unit: 'day' };
  if (safe < 9 * HOURS_PER_WEEK) return { n: Math.round(safe / HOURS_PER_WEEK), unit: 'week' };
  if (safe < 24 * HOURS_PER_MONTH) return { n: Math.round(safe / HOURS_PER_MONTH), unit: 'month' };
  return { n: Math.round(safe / HOURS_PER_YEAR), unit: 'year' };
}

export function fmt(hours: number, locale: Locale = 'en'): string {
  const { n, unit } = coarse(hours);
  return formatCount(n, unit, locale);
}

/**
 * "typically X after quitting" phrasing for a milestone's timing. Never
 * invents a day number the evidence doesn't support — a `noTimeline` timing
 * is returned verbatim in every locale; the localized phrase travels with
 * the (localized) milestone dataset, not with this formatter.
 */
export function timingPhrase(t: MilestoneTiming, locale: Locale = 'en'): string {
  switch (t.kind) {
    case 'window':
      return locale === 'fi'
        ? `tyypillisesti ${fmt(t.earliestHours, locale)}–${fmt(t.typicalUntilHours, locale)} lopettamisen jälkeen`
        : `typically ${fmt(t.earliestHours)}–${fmt(t.typicalUntilHours)} after quitting`;
    case 'point':
      return locale === 'fi'
        ? `noin ${fmt(t.earliestHours, locale)} lopettamisen jälkeen`
        : `around ${fmt(t.earliestHours)} after quitting`;
    case 'openEnded': {
      if (locale === 'fi') {
        const { n, unit } = coarse(t.earliestHours);
        return `${formatCountFrom(n, unit, 'fi')} eteenpäin — ja jatkuu`;
      }
      return `from ${fmt(t.earliestHours)} on — and continuing`;
    }
    case 'noTimeline':
      return t.phrase;
  }
}

export default timingPhrase;
