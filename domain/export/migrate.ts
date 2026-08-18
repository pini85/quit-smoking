/**
 * Version detection + migration chain for import files. Pure — no I/O.
 *
 * Each entry in MIGRATIONS[v] upgrades a file from version v to v+1. A future
 * v2 -> v3 change ships as MIGRATIONS[2], in the SAME change-set as the
 * format/validator bump — a version the writer emits but no migration or
 * validator understands is an unreadable backup.
 */

import { CURRENT_EXPORT_VERSION } from '@/domain/export/format';

export class ImportError extends Error {
  constructor(public reason: string) {
    super(reason);
    this.name = 'ImportError';
  }
}

export const MIGRATIONS: Record<
  number,
  (file: Record<string, unknown>) => Record<string, unknown>
> = {
  // v1 -> v2: the Freedom feature added belief assessments and freedom
  // sessions. A v1 file predates both, so the honest upgrade is two empty
  // collections — never invented rows. Returns a new object; the caller's
  // file is not mutated.
  1: (file) => ({ ...file, schemaVersion: 2, beliefAssessments: [], freedomSessions: [] }),
  // v2 -> v3: sleep/snore monitoring added the sleepSessions collection. A v2
  // file predates it, so the honest upgrade is one empty collection — never
  // invented rows. Returns a new object; the caller's file is not mutated.
  2: (file) => ({ ...file, schemaVersion: 3, sleepSessions: [] }),
};

export function detectVersion(raw: unknown): number {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ImportError('File is not a valid export (expected a JSON object).');
  }
  const obj = raw as Record<string, unknown>;
  const { schemaVersion, app } = obj;

  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion)) {
    throw new ImportError('File is missing a valid schemaVersion.');
  }
  if (app !== 'quit-smoking') {
    throw new ImportError('File was not exported from this app.');
  }
  return schemaVersion;
}

export function migrateToLatest(raw: unknown): Record<string, unknown> {
  let version = detectVersion(raw);
  let file = raw as Record<string, unknown>;

  if (version > CURRENT_EXPORT_VERSION) {
    throw new ImportError(
      `This file was exported from a newer app version (schemaVersion ${version}); please update the app before importing.`
    );
  }

  while (version < CURRENT_EXPORT_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      throw new ImportError(
        `No migration available to upgrade schemaVersion ${version} to ${CURRENT_EXPORT_VERSION}.`
      );
    }
    file = migration(file);
    const nextVersion = detectVersion(file);
    if (nextVersion <= version) {
      throw new ImportError(
        `Migration for schemaVersion ${version} did not advance the file's version.`
      );
    }
    version = nextVersion;
  }

  return file;
}
