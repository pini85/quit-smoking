/**
 * zod/mini schemas validating an already-migrated import file against
 * `ExportFileV3` strictly enough to protect the database. Every optional
 * field that exists on the domain types is declared here too — `z.object()`
 * strips unknown keys, so an omitted-but-real field would silently vanish
 * from a legitimate export on reimport.
 */

import * as z from 'zod/mini';
import { TRIGGERS, OUTCOMES, BELIEFS, LOCALES, SLEEP_SESSION_STATES } from '@/domain/types';
import { ImportError } from '@/domain/export/migrate';
import type { ExportFileV3 } from '@/domain/export/format';

// Every `*At` field in the domain is documented as "ISO 8601 WITH timezone
// offset". `Date.parse` alone is far too permissive — engines also accept
// bare year/day numbers ("2026", "5") with implementation-defined meaning —
// so a shape check runs first to require a full date-time component before
// Date.parse is even consulted for validity.
const ISO_DATE_TIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

function isIsoDateTimeShaped(s: string): boolean {
  return ISO_DATE_TIME_RE.test(s);
}

function isParseableDate(s: string): boolean {
  return !Number.isNaN(Date.parse(s));
}

const dateString = z.string().check(
  z.minLength(1, 'must not be empty'),
  z.refine(isIsoDateTimeShaped, 'must be an ISO 8601 date-time string (YYYY-MM-DDTHH:mm:ss)'),
  z.refine(isParseableDate, 'must be a valid date string')
);

const nonEmptyString = z.string().check(z.minLength(1, 'must not be empty'));

const triggerSchema = z.enum(TRIGGERS);
const outcomeSchema = z.enum(OUTCOMES);
const beliefSchema = z.enum(BELIEFS);

const quitProfileSchema = z.object({
  id: z.literal('singleton'),
  quitAt: dateString,
  cigarettesPerDay: z.number().check(z.gte(1), z.lte(200)),
  cigarettesPerPack: z.number().check(z.gte(1), z.lte(100)),
  packPrice: z.number().check(z.gte(0)),
  currency: nonEmptyString,
  yearsSmoked: z.optional(z.number().check(z.gte(0))),
  createdAt: dateString,
  updatedAt: dateString,
});

const cravingSessionSchema = z.object({
  id: nonEmptyString,
  startedAt: dateString,
  initialIntensity: z.int().check(z.gte(1), z.lte(10)),
  finalIntensity: z.optional(z.int().check(z.gte(1), z.lte(10))),
  trigger: z.optional(triggerSchema),
  outcome: z.nullable(outcomeSchema),
  endedAt: z.optional(dateString),
  interventionIds: z.optional(z.array(nonEmptyString)),
  roundCount: z.optional(z.int().check(z.gte(1))),
  preQuit: z.optional(z.boolean()),
  notes: z.optional(z.string()),
  beliefId: z.optional(beliefSchema),
});

// strength is 0–4 and 0 ("seen through") is a real, meaningful value — do NOT
// copy the 1–10 intensity pattern above, whose floor is 1. Spelled as the
// literal set rather than int + gte(0)/lte(4) because the domain declares
// `strength: 0 | 1 | 2 | 3 | 4`, and only the literal set parses to that union
// (a `number` output would not be assignable to `BeliefAssessment`). Same
// accept/reject behaviour: 0 in, 5 / -1 / 2.5 out.
const beliefAssessmentSchema = z.object({
  id: nonEmptyString,
  beliefId: beliefSchema,
  assessedAt: dateString,
  strength: z.literal([0, 1, 2, 3, 4]),
  context: z.enum(['brain', 'exercise', 'craving']),
  trigger: z.optional(triggerSchema),
});

// endedAt is REQUIRED: freedom sessions are written once, at completion, so a
// row without an end is a corrupt row, not an in-progress one.
const freedomSessionSchema = z.object({
  id: nonEmptyString,
  startedAt: dateString,
  endedAt: dateString,
  kind: z.enum(['brain', 'exercise']),
  beliefId: z.optional(beliefSchema),
  trigger: z.optional(triggerSchema),
  lessonId: z.optional(nonEmptyString),
});

const achievementUnlockSchema = z.object({
  id: nonEmptyString,
  unlockedAt: dateString,
});

const personalReasonSchema = z.object({
  id: nonEmptyString,
  text: nonEmptyString,
  createdAt: dateString,
  archived: z.optional(z.boolean()),
});

const moneyEquivalentSchema = z.object({
  label: nonEmptyString,
  unitPrice: z.number().check(z.gt(0)),
});

const preferencesSchema = z.object({
  id: z.literal('singleton'),
  theme: z.enum(['system', 'light', 'dark']),
  locale: z.optional(z.enum(LOCALES)),
  moneyEquivalents: z.optional(z.array(moneyEquivalentSchema)),
  showEmergingEvidence: z.boolean(),
  dismissedInstallHint: z.optional(z.boolean()),
  lastExportAt: z.optional(dateString),
  keepSnoreClips: z.optional(z.boolean()),
  updatedAt: dateString,
});

// SnoreEvent positions are ms OFFSETS from the owning session's `startedAt`
// (see the doc comment on `SnoreEvent` in domain/types), not ISO instants —
// hence plain non-negative numbers here rather than `dateString`.
const snoreEventSchema = z
  .object({
    startMs: z.number().check(z.gte(0)),
    endMs: z.number().check(z.gt(0)),
    avgDbfs: z.number().check(z.lte(0)),
    peakDbfs: z.number().check(z.lte(0)),
    confidence: z.number().check(z.gte(0), z.lte(1)),
    clipPath: z.optional(nonEmptyString),
  })
  .check(z.refine((e) => e.endMs > e.startMs, 'endMs must be greater than startMs'));

const sleepSessionMetricsSchema = z.object({
  recordingDurationMs: z.number().check(z.gte(0)),
  snoreDurationMs: z.number().check(z.gte(0)),
  snorePercent: z.number().check(z.gte(0), z.lte(100)),
  eventCount: z.number().check(z.gte(0)),
  eventsPerHour: z.number().check(z.gte(0)),
  avgIntensity: z.number().check(z.gte(0), z.lte(1)),
  peakIntensity: z.number().check(z.gte(0), z.lte(1)),
  longestEpisodeMs: z.number().check(z.gte(0)),
  avgEventDurationMs: z.number().check(z.gte(0)),
  snoreBurden: z.number().check(z.gte(0), z.lte(100)),
});

const sleepSessionSchema = z.object({
  id: nonEmptyString,
  startedAt: dateString,
  endedAt: z.optional(dateString),
  state: z.enum(SLEEP_SESSION_STATES),
  interrupted: z.optional(z.boolean()),
  preQuit: z.optional(z.boolean()),
  analysisVersion: z.optional(nonEmptyString),
  metrics: z.optional(sleepSessionMetricsSchema),
  events: z.optional(z.array(snoreEventSchema)),
});

// Only the CURRENT version is validated: `validateExportFile` runs after
// `migrateToLatest`, so anything older has already been upgraded in place.
const exportFileV3Schema = z.object({
  schemaVersion: z.literal(3),
  app: z.literal('quit-smoking'),
  exportedAt: dateString,
  profile: z.nullable(quitProfileSchema),
  cravings: z.array(cravingSessionSchema),
  achievementUnlocks: z.array(achievementUnlockSchema),
  reasons: z.array(personalReasonSchema),
  preferences: z.nullable(preferencesSchema),
  beliefAssessments: z.array(beliefAssessmentSchema),
  freedomSessions: z.array(freedomSessionSchema),
  sleepSessions: z.array(sleepSessionSchema),
});

export function validateExportFile(migrated: unknown): ExportFileV3 {
  const result = exportFileV3Schema.safeParse(migrated);
  if (!result.success) {
    const [firstIssue] = result.error.issues;
    const path = firstIssue.path.length > 0 ? firstIssue.path.join('.') : '(root)';
    throw new ImportError(`Invalid export file at "${path}": ${firstIssue.message}`);
  }
  return result.data;
}
