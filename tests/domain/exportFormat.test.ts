import { describe, expect, it } from 'vitest';
import {
  buildExportFile,
  exportFileName,
  CURRENT_EXPORT_VERSION,
  type ExportSnapshot,
  type ExportSnapshotV1,
  type ExportSnapshotV2,
  type ExportFileV1,
  type ExportFileV2,
} from '@/domain/export/format';
import type { SleepSession } from '@/domain/types';

function emptySnapshot(): ExportSnapshot {
  return {
    profile: null,
    cravings: [],
    achievementUnlocks: [],
    reasons: [],
    preferences: null,
    beliefAssessments: [],
    freedomSessions: [],
    sleepSessions: [],
  };
}

function sleepSession(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    id: 'sleep-1',
    startedAt: '2026-01-03T23:00:00+02:00',
    endedAt: '2026-01-04T06:30:00+02:00',
    state: 'analyzed',
    analysisVersion: 'v1',
    metrics: {
      recordingDurationMs: 27000000,
      snoreDurationMs: 1200000,
      snorePercent: 4.4,
      eventCount: 12,
      eventsPerHour: 1.6,
      avgIntensity: 0.4,
      peakIntensity: 0.8,
      longestEpisodeMs: 60000,
      avgEventDurationMs: 20000,
      snoreBurden: 15,
    },
    events: [
      { startMs: 1000, endMs: 5000, avgDbfs: -20, peakDbfs: -10, confidence: 0.9 },
    ],
    ...overrides,
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
      sleepSessions: [],
    };

    const file = buildExportFile(snapshot, '2026-01-05T12:00:00Z');

    expect(file.profile).toEqual(snapshot.profile);
    expect(file.cravings).toEqual(snapshot.cravings);
    expect(file.achievementUnlocks).toEqual(snapshot.achievementUnlocks);
    expect(file.reasons).toEqual(snapshot.reasons);
    expect(file.preferences).toEqual(snapshot.preferences);
  });

  it('writes v3: schemaVersion 3 and sleepSessions carried through', () => {
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
      sleepSessions: [sleepSession()],
    };

    const file = buildExportFile(snapshot, '2026-01-05T12:00:00Z');

    expect(file.schemaVersion).toBe(3);
    expect(CURRENT_EXPORT_VERSION).toBe(3);
    expect(file.beliefAssessments).toEqual(snapshot.beliefAssessments);
    expect(file.freedomSessions).toEqual(snapshot.freedomSessions);
    expect(file.sleepSessions).toEqual(snapshot.sleepSessions);
  });

  it('emits all three v2/v3-introduced collections even when empty, so the key is never absent', () => {
    const file = buildExportFile(emptySnapshot(), '2026-01-05T12:00:00Z');
    const reparsed = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
    expect(reparsed).toHaveProperty('beliefAssessments');
    expect(reparsed).toHaveProperty('freedomSessions');
    expect(reparsed).toHaveProperty('sleepSessions');
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

describe('ExportSnapshotV2 (frozen v2 shape)', () => {
  it('still describes exactly the seven v2 collections, without sleepSessions', () => {
    // A v2 value must remain assignable to ExportSnapshotV2 without the v3
    // `sleepSessions` key — if growing `ExportSnapshot` had redefined v2 in
    // place, this literal would stop compiling.
    const v2: ExportSnapshotV2 = {
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
      beliefAssessments: [],
      freedomSessions: [],
    };
    expect(Object.keys(v2)).toHaveLength(7);
  });

  it('ExportFileV2 is still a seven-collection v2 file', () => {
    const file: ExportFileV2 = {
      schemaVersion: 2,
      app: 'quit-smoking',
      exportedAt: '2026-01-05T12:00:00Z',
      profile: null,
      cravings: [],
      achievementUnlocks: [],
      reasons: [],
      preferences: null,
      beliefAssessments: [],
      freedomSessions: [],
    };
    expect(file.schemaVersion).toBe(2);
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
