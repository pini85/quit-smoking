import type { Locale } from '@/domain/types';

/**
 * Locale-aware `Intl` formatter factories.
 *
 * The mapping is deliberately asymmetric: `'en'` maps to `undefined` — the
 * device's own locale — because that is exactly what every call site did
 * before the app had a language setting, and existing users' date/number
 * rendering must not change out from under them. `'fi'` pins Finnish
 * conventions regardless of device locale, so the whole UI reads as one
 * language.
 */
export function intlLocale(locale: Locale): string | undefined {
  return locale === 'en' ? undefined : locale;
}

// `Intl.DateTimeFormat` construction is expensive; call sites used to hoist
// instances to module scope. That hoisting is impossible once the locale is
// dynamic, so the cache here plays the same role.
const dateFmtCache = new Map<string, Intl.DateTimeFormat>();
const numberFmtCache = new Map<string, Intl.NumberFormat>();

export function dateFmt(locale: Locale, opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(opts ?? {})}`;
  let fmt = dateFmtCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(intlLocale(locale), opts);
    dateFmtCache.set(key, fmt);
  }
  return fmt;
}

export function numberFmt(locale: Locale, opts?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(opts ?? {})}`;
  let fmt = numberFmtCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(intlLocale(locale), opts);
    numberFmtCache.set(key, fmt);
  }
  return fmt;
}
