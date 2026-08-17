/**
 * Version detection + migration chain for import files. Pure — no I/O.
 *
 * Each entry in MIGRATIONS[v] upgrades a file from version v to v+1. Empty
 * today (only CURRENT_EXPORT_VERSION = 1 exists); a future v1 -> v2 change
 * ships as MIGRATIONS[1].
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
> = {};

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
