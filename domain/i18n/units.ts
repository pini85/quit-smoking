/**
 * Per-locale duration-unit formatting. English pluralizes with a suffix;
 * Finnish needs real forms — nominative singular after exactly 1
 * ("1 viikko"), partitive singular after every other numeral ("3 viikkoa"),
 * and the elative for "from X on" phrasings ("2 viikosta eteenpäin") — so
 * units are a form table per locale, never string surgery.
 *
 * Pure and dependency-free, like everything under `domain/`.
 */

import type { Locale } from '../types';

export type DurationUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

type UnitForms = {
  one: string; // exactly 1
  other: string; // any other count (fi: partitive)
  from: string; // "from N <unit> on" (fi: elative; en reuses one/other)
};

const UNITS: Record<Locale, Record<DurationUnit, UnitForms>> = {
  en: {
    minute: { one: 'minute', other: 'minutes', from: 'minutes' },
    hour: { one: 'hour', other: 'hours', from: 'hours' },
    day: { one: 'day', other: 'days', from: 'days' },
    week: { one: 'week', other: 'weeks', from: 'weeks' },
    month: { one: 'month', other: 'months', from: 'months' },
    year: { one: 'year', other: 'years', from: 'years' },
  },
  fi: {
    minute: { one: 'minuutti', other: 'minuuttia', from: 'minuutista' },
    hour: { one: 'tunti', other: 'tuntia', from: 'tunnista' },
    day: { one: 'päivä', other: 'päivää', from: 'päivästä' },
    week: { one: 'viikko', other: 'viikkoa', from: 'viikosta' },
    month: { one: 'kuukausi', other: 'kuukautta', from: 'kuukaudesta' },
    year: { one: 'vuosi', other: 'vuotta', from: 'vuodesta' },
  },
};

export function formatCount(n: number, unit: DurationUnit, locale: Locale = 'en'): string {
  const forms = UNITS[locale][unit];
  return `${n} ${n === 1 ? forms.one : forms.other}`;
}

/** "from N <unit>" fragment: en "2 weeks", fi elative "2 viikosta". */
export function formatCountFrom(n: number, unit: DurationUnit, locale: Locale = 'en'): string {
  const forms = UNITS[locale][unit];
  return `${n} ${locale === 'fi' ? forms.from : n === 1 ? forms.one : forms.other}`;
}

// Compact clock-ish bands. English glues the letter to the digit ("3h");
// Finnish abbreviations are word-like and take a space ("3 t").
const COMPACT: Record<Locale, Partial<Record<DurationUnit, string>>> = {
  en: { day: 'd', hour: 'h', minute: 'm' },
  fi: { day: 'pv', hour: 't', minute: 'min' },
};

export function formatCompact(n: number, unit: DurationUnit, locale: Locale = 'en'): string {
  const abbr = COMPACT[locale][unit];
  if (!abbr) return formatCount(n, unit, locale);
  return locale === 'fi' ? `${n} ${abbr}` : `${n}${abbr}`;
}
