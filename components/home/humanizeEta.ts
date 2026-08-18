import type { Locale } from '@/domain/types';

/**
 * "How far away is that milestone?" in the vaguest honest terms.
 *
 * Deliberately coarse: the health dataset's timings are approximations, so a
 * to-the-minute countdown would imply a precision the evidence doesn't have.
 * Pure — takes a duration, never reads the clock. Finnish uses the genitive
 * + kuluttua construction ("noin 3 tunnin kuluttua").
 */
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function humanizeEta(ms: number, locale: Locale = 'en'): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;

  if (locale === 'fi') {
    if (safe < HOUR_MS) return 'alle tunnin kuluttua';
    if (safe < 48 * HOUR_MS) return `noin ${Math.round(safe / HOUR_MS)} tunnin kuluttua`;
    return `noin ${Math.round(safe / DAY_MS)} päivän kuluttua`;
  }

  if (safe < HOUR_MS) return 'in under an hour';
  if (safe < 48 * HOUR_MS) return `in about ${Math.round(safe / HOUR_MS)}h`;
  return `in about ${Math.round(safe / DAY_MS)} days`;
}

export default humanizeEta;
