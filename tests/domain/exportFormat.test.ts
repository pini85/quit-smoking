import { describe, expect, it } from 'vitest';
import {
  buildExportFile,
  exportFileName,
  CURRENT_EXPORT_VERSION,
  type ExportSnapshot,
} from '@/domain/export/format';

function emptySnapshot(): ExportSnapshot {
  return {
    profile: null,
    cravings: [],
    achievementUnlocks: [],
    reasons: [],
    preferences: null,
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
    };

    const file = buildExportFile(snapshot, '2026-01-05T12:00:00Z');

    expect(file.profile).toEqual(snapshot.profile);
    expect(file.cravings).toEqual(snapshot.cravings);
    expect(file.achievementUnlocks).toEqual(snapshot.achievementUnlocks);
    expect(file.reasons).toEqual(snapshot.reasons);
    expect(file.preferences).toEqual(snapshot.preferences);
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
