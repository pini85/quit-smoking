/**
 * Pure "quit" statistics — smoke-free duration, cigarettes/money saved,
 * life regained, and recovery-stage classification.
 *
 * All functions are pure and take an explicit `now: Date` where they are
 * time-dependent — nothing here calls `Date.now()`. Sessions with
 * `preQuit: true` are EXCLUDED here (per global semantics); craving-stats
 * functions include them instead.
 */

import type { CravingSession, Duration, Locale, MoneyEquivalent, QuitProfile } from '@/domain/types';
import { durationBetween, hoursBetween } from '@/domain/time';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Reuses durationBetween's own clamping/splitting logic — no reimplementation. */
function durationFromMs(ms: number): Duration {
  return durationBetween(new Date(0), new Date(ms));
}

export function smokeFreeDuration(quitAt: Date, now: Date): Duration {
  return durationBetween(quitAt, now);
}

/**
 * The latest of quitAt and the endedAt/startedAt of any non-preQuit session
 * with outcome 'smoked' — i.e. when the CURRENT streak actually began.
 */
export function currentStreakStart(quitAt: Date, cravings: CravingSession[]): Date {
  let latest = quitAt;
  for (const session of cravings) {
    if (session.preQuit) continue;
    if (session.outcome !== 'smoked') continue;
    const at = new Date(session.endedAt ?? session.startedAt);
    if (at.getTime() > latest.getTime()) {
      latest = at;
    }
  }
  return latest;
}

function fractionalDaysSince(quitAt: Date, now: Date): number {
  return Math.max(0, hoursBetween(quitAt, now) / 24);
}

export function cigarettesAvoided(profile: QuitProfile, now: Date): number {
  const quitAt = new Date(profile.quitAt);
  const days = fractionalDaysSince(quitAt, now);
  return Math.max(0, Math.floor(profile.cigarettesPerDay * days));
}

export function packsAvoided(profile: QuitProfile, now: Date): number {
  if (profile.cigarettesPerPack <= 0) return 0;
  const avoided = cigarettesAvoided(profile, now);
  return round1(avoided / profile.cigarettesPerPack);
}

export function moneySaved(profile: QuitProfile, now: Date): number {
  if (profile.cigarettesPerPack <= 0) return 0;
  const quitAt = new Date(profile.quitAt);
  const days = fractionalDaysSince(quitAt, now);
  const saved = (profile.cigarettesPerDay / profile.cigarettesPerPack) * profile.packPrice * days;
  return round2(Math.max(0, saved));
}

/** UCL 2024 estimate (~17-22 min); UI should show "≈" plus a methodology note. */
export const MINUTES_OF_LIFE_PER_CIGARETTE = 20;

export function lifeRegained(cigarettesAvoidedCount: number): Duration {
  const minutes = Math.max(0, cigarettesAvoidedCount) * MINUTES_OF_LIFE_PER_CIGARETTE;
  return durationFromMs(minutes * 60_000);
}

/** Time not spent physically smoking (~5-6 min/cigarette) — distinct from life regained. */
export function timeSaved(cigarettesAvoidedCount: number, minutesPerCigarette = 6): Duration {
  const minutes = Math.max(0, cigarettesAvoidedCount) * minutesPerCigarette;
  return durationFromMs(minutes * 60_000);
}

export function moneyEquivalentsFor(
  saved: number,
  eq: MoneyEquivalent[] | undefined
): { label: string; count: number }[] {
  if (!eq || eq.length === 0) return [];
  return eq
    .filter((e) => e.unitPrice > 0)
    .map((e) => ({ label: e.label, count: Math.floor(saved / e.unitPrice) }))
    .filter((e) => e.count >= 1)
    .sort((a, b) => b.count - a.count);
}

export type RecoveryStage =
  | 'first-hours'
  | 'first-days'
  | 'withdrawal-peak'
  | 'early-recovery'
  | 'consolidation'
  | 'established'
  | 'free';

const HOUR_1_MONTH = 730; // per brief: 1mo = 730h
const HOUR_1_YEAR = 8766; // per brief: 1y = 8766h
const HOUR_3_MONTHS = HOUR_1_MONTH * 3;

/**
 * <24h first-hours · 24-48h first-days · 48-96h withdrawal-peak ·
 * 96h-1mo early-recovery · 1-3mo consolidation · 3mo-1y established ·
 * >=1y free. The brief's "4wk" upper bound for early-recovery and its
 * "1mo" lower bound for consolidation are treated as the same transition
 * point (using the brief's own 1mo = 730h conversion) so the stages stay
 * contiguous and non-overlapping.
 */
export function recoveryStage(quitAt: Date, now: Date): RecoveryStage {
  const hours = hoursBetween(quitAt, now);
  if (hours < 24) return 'first-hours';
  if (hours < 48) return 'first-days';
  if (hours < 96) return 'withdrawal-peak';
  if (hours < HOUR_1_MONTH) return 'early-recovery';
  if (hours < HOUR_3_MONTHS) return 'consolidation';
  if (hours < HOUR_1_YEAR) return 'established';
  return 'free';
}

export const RECOVERY_STAGE_LABELS: Record<RecoveryStage, string> = {
  'first-hours': 'First hours',
  'first-days': 'First days',
  'withdrawal-peak': 'Withdrawal peak',
  'early-recovery': 'Early recovery',
  consolidation: 'Consolidation',
  established: 'Established',
  free: 'Free',
};

// Machine-translated, pending native-speaker review — see
// docs/i18n-finnish-review.md.
const RECOVERY_STAGE_LABELS_FI: Record<RecoveryStage, string> = {
  'first-hours': 'Ensimmäiset tunnit',
  'first-days': 'Ensimmäiset päivät',
  'withdrawal-peak': 'Vieroitusoireiden huippu',
  'early-recovery': 'Varhainen toipuminen',
  consolidation: 'Vakiintumisvaihe',
  established: 'Vakiintunut',
  free: 'Vapaa',
};

export function recoveryStageLabel(stage: RecoveryStage, locale: Locale = 'en'): string {
  return locale === 'fi' ? RECOVERY_STAGE_LABELS_FI[stage] : RECOVERY_STAGE_LABELS[stage];
}
