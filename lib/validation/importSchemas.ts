/**
 * zod/mini schemas validating an already-migrated import file against
 * `ExportFileV1` strictly enough to protect the database. Every optional
 * field that exists on the domain types is declared here too — `z.object()`
 * strips unknown keys, so an omitted-but-real field would silently vanish
 * from a legitimate export on reimport.
 */

import * as z from 'zod/mini';
import { TRIGGERS, OUTCOMES } from '@/domain/types';
import { ImportError } from '@/domain/export/migrate';
import type { ExportFileV1 } from '@/domain/export/format';

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
  moneyEquivalents: z.optional(z.array(moneyEquivalentSchema)),
  showEmergingEvidence: z.boolean(),
  dismissedInstallHint: z.optional(z.boolean()),
  lastExportAt: z.optional(dateString),
  updatedAt: dateString,
});

const exportFileV1Schema = z.object({
  schemaVersion: z.literal(1),
  app: z.literal('quit-smoking'),
  exportedAt: dateString,
  profile: z.nullable(quitProfileSchema),
  cravings: z.array(cravingSessionSchema),
  achievementUnlocks: z.array(achievementUnlockSchema),
  reasons: z.array(personalReasonSchema),
  preferences: z.nullable(preferencesSchema),
});

export function validateExportFile(migrated: unknown): ExportFileV1 {
  const result = exportFileV1Schema.safeParse(migrated);
  if (!result.success) {
    const [firstIssue] = result.error.issues;
    const path = firstIssue.path.length > 0 ? firstIssue.path.join('.') : '(root)';
    throw new ImportError(`Invalid export file at "${path}": ${firstIssue.message}`);
  }
  return result.data;
}
