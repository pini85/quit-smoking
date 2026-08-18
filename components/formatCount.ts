import type { Locale } from '@/domain/types';
import { intlLocale } from '@/lib/i18n/fmt';

/**
 * Locale-grouped integer formatting for the app's whole-number stats.
 *
 * A ten-year quit at 20/day produces ~73,000 cigarettes not smoked and a
 * four-digit "days of life regained"; rendered raw those read as a wall of
 * digits. `toLocaleString` supplies whichever grouping separator the locale
 * uses ('en' follows the device, exactly the pre-i18n behavior), so this
 * never hard-codes a comma.
 */
export function formatCount(n: number, locale: Locale = 'en'): string {
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString(intlLocale(locale));
}

export default formatCount;
