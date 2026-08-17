/**
 * Pure domain types for the quit-smoking app.
 *
 * This module has no behavior beyond simple type guards — it must stay free
 * of React, Dexie, `window`, and any wall-clock access (`Date.now()` /
 * argless `new Date()`).
 */

export interface QuitProfile {
  id: 'singleton';
  quitAt: string; // ISO 8601 WITH timezone offset; moment of last cigarette
  cigarettesPerDay: number;
  cigarettesPerPack: number;
  packPrice: number; // decimal in profile currency
  currency: string; // ISO 4217, e.g. 'EUR'
  yearsSmoked?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalReason {
  id: string; // uuid
  text: string;
  createdAt: string;
  archived?: boolean;
}

export const TRIGGERS = [
  'stress',
  'boredom',
  'after-food',
  'coffee',
  'alcohol',
  'social',
  'habit',
  'emotional',
  'seeing-smoking',
  'other',
] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const OUTCOMES = [
  'passed',
  'much-weaker',
  'still-there',
  'smoked',
  'unresolved',
] as const;
export type CravingOutcome = (typeof OUTCOMES)[number];
// 'unresolved' = session auto-finalized after abandonment; excluded from BOTH
// numerator and denominator of pass rate. Pass rate = resolved non-smoked / resolved,
// where resolved = outcome !== 'unresolved' and outcome != null.

export interface CravingSession {
  id: string; // uuid
  startedAt: string; // ISO WITH offset — offset preserves local hour-of-day
  initialIntensity: number; // 1–10
  finalIntensity?: number; // absent if unresolved
  trigger?: Trigger;
  outcome: CravingOutcome | null; // null = session still open (in progress)
  endedAt?: string; // duration is DERIVED (endedAt - startedAt); never stored
  interventionIds?: string[]; // which interrupters were shown (in order, per round)
  roundCount?: number; // defaults to 1 when absent
  preQuit?: boolean; // logged before quit moment (future quit date mode)
  notes?: string;
}

export type EvidenceLevel = 'strong' | 'moderate' | 'emerging';

export const MILESTONE_CATEGORIES = [
  'heart',
  'lungs',
  'brain',
  'sleep',
  'skin',
  'mouth',
  'circulation',
  'exercise',
  'senses',
  'immune',
  'cancer-risk',
  'sexual-health',
  'mental',
  'fertility',
  'metabolic',
  'eyes',
  'bones',
  'family',
  'freedom',
  'longevity',
] as const;
export type MilestoneCategory = (typeof MILESTONE_CATEGORIES)[number];

/** Honest timing — never invent a day number the evidence doesn't support. */
export type MilestoneTiming =
  | { kind: 'window'; earliestHours: number; typicalUntilHours: number }
  | { kind: 'point'; earliestHours: number }
  | { kind: 'openEnded'; earliestHours: number }
  | { kind: 'noTimeline'; phrase: string };

export interface HealthMilestone {
  id: string;
  category: MilestoneCategory;
  title: string;
  description: string;
  timing: MilestoneTiming;
  evidenceLevel: EvidenceLevel;
  sources: { label: string; url: string }[];
  didYouKnow?: boolean;
  honestNote?: string; // "worse before better" caveats
}

export type AchievementCondition =
  | { type: 'smoke-free-hours'; hours: number }
  | { type: 'cigarettes-avoided'; count: number }
  | { type: 'money-saved'; amount: number }
  | { type: 'cravings-passed'; count: number }
  | { type: 'trigger-passed'; trigger: Trigger; count: number }
  | { type: 'craving-free-hours'; hours: number }
  | { type: 'smoke-free-weekend'; count: 1 }; // Fri 18:00 → Mon 06:00 local

export interface AchievementDefinition {
  id: string;
  title: string;
  fact: string; // ties to a real health/money/time fact
  condition: AchievementCondition;
  tier: 1 | 2 | 3;
}

export interface AchievementUnlock {
  id: string; // = definition id
  unlockedAt: string;
}

export interface MoneyEquivalent {
  label: string;
  unitPrice: number;
}

export interface Preferences {
  id: 'singleton';
  theme: 'system' | 'light' | 'dark';
  moneyEquivalents?: MoneyEquivalent[];
  showEmergingEvidence: boolean;
  dismissedInstallHint?: boolean;
  lastExportAt?: string;
  updatedAt: string;
}

export interface Duration {
  totalMs: number;
  days: number; // whole days
  hours: number; // remainder 0-23
  minutes: number; // remainder 0-59
  seconds: number; // remainder 0-59
}

export function isTrigger(x: unknown): x is Trigger {
  return typeof x === 'string' && (TRIGGERS as readonly string[]).includes(x);
}

export function isOutcome(x: unknown): x is CravingOutcome {
  return typeof x === 'string' && (OUTCOMES as readonly string[]).includes(x);
}

export function isMilestoneCategory(x: unknown): x is MilestoneCategory {
  return (
    typeof x === 'string' &&
    (MILESTONE_CATEGORIES as readonly string[]).includes(x)
  );
}
