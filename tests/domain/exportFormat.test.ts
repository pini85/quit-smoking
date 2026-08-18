import { describe, expect, it } from 'vitest';
import {
  buildExportFile,
  exportFileName,
  CURRENT_EXPORT_VERSION,
  type ExportSnapshot,
  type ExportSnapshotV1,
  type ExportFileV1,
} from '@/domain/export/format';

function emptySnapshot(): ExportSnapshot {
  return {
    profile: null,
    cravings: [],
    achievementUnlocks: [],
    reasons: [],
    preferences: null,
    beliefAssessments: [],
    freedomSessions: [],
  };
}

describe('buildExportFile', () => {
  it('stamps schemaVersion, app id, and exportedAt onto the snapshot', () => {
    const snapshot = emptySnapshot();
    const file = buildExportFile(snapshot, '2026-01-05T12:00:00Z');

    expect(file.schemaVersion).toBe(CURRENT_EXPORT_VERSION);
    expect(file.app).toBe('quit-smoking');
    expect(file.exportedAt).toBe('2026-01-05T12:00:00Z');
  });

  it('carries the snapshot data through unchanged', () => {
    const snapshot: ExportSnapshot = {
      profile: {
        id: 'singleton',
        quitAt: '2026-01-01T08:00:00Z',
        cigarettesPerDay: 20,
        cigarettesPerPack: 20,
        packPrice: 10,
        currency: 'EUR',
        createdAt: '2026-01-01T08:00:00Z',
        updatedAt: '2026-01-01T08:00:00Z',
      },
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
      beliefAssessments: [],
      freedomSessions: [],
    };

    const file = buildExportFile(snapshot, '2026-01-05T12:00:00Z');

    expect(file.profile).toEqual(snapshot.profile);
    expect(file.cravings).toEqual(snapshot.cravings);
    expect(file.achievementUnlocks).toEqual(snapshot.achievementUnlocks);
    expect(file.reasons).toEqual(snapshot.reasons);
    expect(file.preferences).toEqual(snapshot.preferences);
  });

  it('writes v2: schemaVersion 2 and both freedom collections carried through', () => {
    const snapshot: ExportSnapshot = {
      ...emptySnapshot(),
      beliefAssessments: [
        {
          id: 'ba-1',
          beliefId: 'relaxation',
          assessedAt: '2026-01-03T09:00:00+02:00',
          strength: 3,
          context: 'brain',
        },
      ],
      freedomSessions: [
        {
          id: 'fs-1',
          startedAt: '2026-01-03T09:00:00+02:00',
          endedAt: '2026-01-03T09:04:00+02:00',
          kind: 'brain',
          beliefId: 'relaxation',
        },
      ],
    };

    const file = buildExportFile(snapshot, '2026-01-05T12:00:00Z');

    expect(file.schemaVersion).toBe(2);
    expect(CURRENT_EXPORT_VERSION).toBe(2);
    expect(file.beliefAssessments).toEqual(snapshot.beliefAssessments);
    expect(file.freedomSessions).toEqual(snapshot.freedomSessions);
  });

  it('emits both new collections even when empty, so the key is never absent', () => {
    const file = buildExportFile(emptySnapshot(), '2026-01-05T12:00:00Z');
    const reparsed = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
    expect(reparsed).toHaveProperty('beliefAssessments');
    expect(reparsed).toHaveProperty('freedomSessions');
  });
});

describe('ExportSnapshotV1 (frozen v1 shape)', () => {
  it('still describes exactly the five original collections', () => {
    // A v1 value must remain assignable to ExportSnapshotV1 without the two
    // v2 keys — if growing ExportSnapshot had redefined v1 in place, this
    // literal would stop compiling.
    const v1: ExportSnapshotV1 = {
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    };
    expect(Object.keys(v1)).toHaveLength(5);
  });

  it('ExportFileV1 is still a five-collection v1 file', () => {
    const file: ExportFileV1 = {
      schemaVersion: 1,
      app: 'quit-smoking',
      exportedAt: '2026-01-05T12:00:00Z',
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
    };
    expect(file.schemaVersion).toBe(1);
  });
});

describe('exportFileName', () => {
  it('formats the date as quit-smoking-export-YYYY-MM-DD.json', () => {
    expect(exportFileName('2026-01-05T12:34:56Z')).toBe(
      'quit-smoking-export-2026-01-05.json'
    );
  });

  it('pads single-digit months and days', () => {
    expect(exportFileName('2026-03-07T00:00:00Z')).toBe(
      'quit-smoking-export-2026-03-07.json'
    );
  });

  it('uses the UTC calendar date, not local time', () => {
    // 2026-01-05T23:30:00-05:00 is 2026-01-06T04:30:00Z.
    expect(exportFileName('2026-01-05T23:30:00-05:00')).toBe(
      'quit-smoking-export-2026-01-06.json'
    );
  });
});
