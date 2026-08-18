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
  beliefId?: Belief; // what the craving felt like it was promising; tagged optionally after completion
}

export const BELIEFS = [
  'relaxation',
  'stress-relief',
  'coffee-ritual',
  'alcohol-pairing',
  'meal-completion',
  'concentration',
  'boredom-relief',
  'reward',
  'break-permission',
  'social-ease',
  'confidence',
  'identity',
  'deprivation',
  'just-one',
  'miss-it-forever',
  'always-want',
  'life-worse',
  'willpower-needed',
] as const;
export type Belief = (typeof BELIEFS)[number];

export interface BeliefAssessment {
  id: string; // uuid
  beliefId: Belief;
  assessedAt: string; // ISO WITH offset (toLocalIso)
  strength: 0 | 1 | 2 | 3 | 4; // 4 = still fully convincing … 0 = seen through
  context: 'brain' | 'exercise' | 'craving';
  trigger?: Trigger;
}

// FreedomSession rows are written ONCE, at completion (endedAt is required).
// A "brain" (belief-assessment) or "exercise" (lesson) flow that gets
// abandoned mid-way writes nothing at all — there is no finalizer and no
// 'unresolved' analog here. Contrast with CravingSession, which writes early
// (outcome: null) and finalizes on abandonment, because losing a mid-crisis
// craving session would poison the pass rate; a freedom-flow drop-off carries
// no such cost, so it is simply not recorded.
export interface FreedomSession {
  id: string; // uuid
  startedAt: string; // ISO WITH offset
  endedAt: string; // ISO WITH offset — required; see write-once contract above
  kind: 'brain' | 'exercise';
  beliefId?: Belief;
  trigger?: Trigger;
  lessonId?: string; // 'exercise' kind
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

// UI languages the app can render. English is the default and the schema
// locale: an absent `Preferences.locale` means 'en', so rows written before
// this field existed keep their exact behavior.
export const LOCALES = ['en', 'fi'] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (LOCALES as readonly string[]).includes(x);
}

export interface Preferences {
  id: 'singleton';
  theme: 'system' | 'light' | 'dark';
  locale?: Locale; // absent = 'en'
  moneyEquivalents?: MoneyEquivalent[];
  showEmergingEvidence: boolean;
  dismissedInstallHint?: boolean;
  lastExportAt?: string;
  keepSnoreClips?: boolean; // absent = false (privacy default OFF)
  updatedAt: string;
}

// Snore monitoring — a sleep-adjacent, opt-in feature. The native (Kotlin)
// layer records overnight audio and writes a per-frame features file; the
// domain layer only ever sees the derived SnoreEvent spans, never audio.
//
// SnoreEvent positions are intra-session ms OFFSETS from the owning
// SleepSession's `startedAt` (durations, not row timestamps) — deliberately
// unlike every other domain row, which stores absolute ISO-with-offset
// instants. Two reasons: (1) the session's `startedAt` already carries the
// timezone, so per-event offsets lose no information; (2) a night produces
// on the order of 10^2 events, and storing each as its own ISO string would
// meaningfully bloat both the IndexedDB rows and JSON exports for no benefit.
export interface SnoreEvent {
  startMs: number; // offset from SleepSession.startedAt, inclusive
  endMs: number; // exclusive; endMs > startMs
  avgDbfs: number; // mean RMS dBFS over member frames (<= 0); relative loudness, NEVER calibrated SPL
  peakDbfs: number;
  confidence: number; // 0..1, rounded to 2 decimals when stored
  clipPath?: string; // native clip file reference; may be dangling after import to another device
}

export const SLEEP_SESSION_STATES = ['recording', 'recorded', 'analyzed', 'failed'] as const;
export type SleepSessionState = (typeof SLEEP_SESSION_STATES)[number];

export function isSleepSessionState(v: unknown): v is SleepSessionState {
  return typeof v === 'string' && (SLEEP_SESSION_STATES as readonly string[]).includes(v);
}

export interface SleepSessionMetrics {
  recordingDurationMs: number;
  snoreDurationMs: number;
  snorePercent: number; // 0..100, 1 decimal
  eventCount: number;
  eventsPerHour: number; // 1 decimal
  avgIntensity: number; // 0..1 normalized relative loudness
  peakIntensity: number; // 0..1
  longestEpisodeMs: number; // episodes = events merged across gaps <= 60s
  avgEventDurationMs: number; // 0 when eventCount === 0
  snoreBurden: number; // 0..100 integer; internal app metric, NOT medical
}

// State meanings:
// - 'recording': row written at start; native getStatus() is the source of
//   truth for liveness (this row is NOT polled to detect a crashed session).
// - 'recorded': stopped, full-night audio retained natively; analysis is
//   pending or failed-retryable.
// - 'analyzed': final state — full-night audio has been deleted natively;
//   `metrics`/`events`/`analysisVersion` are populated and authoritative.
// - 'failed': no analyzable audio survived (e.g. too short, corrupt file).
export interface SleepSession {
  id: string; // uuid; equals the native recorder sessionId
  startedAt: string; // ISO 8601 WITH local offset (toLocalIso)
  endedAt?: string; // absent while state === 'recording'
  state: SleepSessionState;
  interrupted?: boolean; // abnormal end (crash/reboot/error/low storage); metrics still valid for recorded span
  preQuit?: boolean; // pinned at start: startedAt < profile.quitAt
  analysisVersion?: string; // present iff state === 'analyzed'
  metrics?: SleepSessionMetrics; // present iff analyzed — STORED, not recomputed (feature frames are discarded)
  events?: SnoreEvent[]; // present iff analyzed
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

export function isBelief(x: unknown): x is Belief {
  return typeof x === 'string' && (BELIEFS as readonly string[]).includes(x);
}
