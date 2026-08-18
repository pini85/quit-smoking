import { describe, expect, it } from 'vitest';
import { validateExportFile } from '@/lib/validation/importSchemas';
import { ImportError } from '@/domain/export/migrate';
import type { ExportFileV3 } from '@/domain/export/format';
import { BELIEFS, SLEEP_SESSION_STATES } from '@/domain/types';

// `validateExportFile` only ever sees ALREADY-migrated files, so the shape it
// must accept is the CURRENT version (v3) — a v1 or v2 file reaches it only
// after MIGRATIONS[1]/MIGRATIONS[2] have added the freedom collections and
// then sleepSessions.
function validFile(overrides: Partial<ExportFileV3> = {}): Record<string, unknown> {
  return {
    schemaVersion: 3,
    app: 'quit-smoking',
    exportedAt: '2026-01-05T12:00:00Z',
    profile: null,
    cravings: [],
    achievementUnlocks: [],
    reasons: [],
    preferences: null,
    beliefAssessments: [],
    freedomSessions: [],
    sleepSessions: [],
    ...overrides,
  };
}

const validProfile = {
  id: 'singleton',
  quitAt: '2026-01-01T08:00:00Z',
  cigarettesPerDay: 20,
  cigarettesPerPack: 20,
  packPrice: 10,
  currency: 'EUR',
  createdAt: '2026-01-01T08:00:00Z',
  updatedAt: '2026-01-01T08:00:00Z',
};

const validCraving = {
  id: 'craving-1',
  startedAt: '2026-01-01T08:00:00Z',
  initialIntensity: 5,
  outcome: null,
};

describe('validateExportFile — happy path', () => {
  it('accepts a minimal empty file', () => {
    const file = validateExportFile(validFile());
    expect(file.schemaVersion).toBe(3);
    expect(file.app).toBe('quit-smoking');
    expect(file.profile).toBeNull();
  });

  it('accepts a fully populated file and preserves every optional field', () => {
    const raw = validFile({
      profile: { ...validProfile, yearsSmoked: 12 },
      cravings: [
        {
          ...validCraving,
          finalIntensity: 2,
          trigger: 'stress',
          outcome: 'passed',
          endedAt: '2026-01-01T08:10:00Z',
          interventionIds: ['breathing', 'walk'],
          roundCount: 2,
          preQuit: false,
          notes: 'handled it',
        },
      ],
      achievementUnlocks: [{ id: 'first-day', unlockedAt: '2026-01-02T08:00:00Z' }],
      reasons: [
        { id: 'r1', text: 'For my health', createdAt: '2026-01-01T08:00:00Z', archived: true },
      ],
      preferences: {
        id: 'singleton',
        theme: 'dark',
        moneyEquivalents: [{ label: 'coffee', unitPrice: 3.5 }],
        showEmergingEvidence: true,
        dismissedInstallHint: true,
        lastExportAt: '2026-01-04T08:00:00Z',
        updatedAt: '2026-01-04T08:00:00Z',
      },
    } as unknown as Partial<ExportFileV3>);

    const file = validateExportFile(raw);

    // Nothing silently stripped — every field the domain type allows must
    // survive validation, or a real export would lose user data on reimport.
    expect(file.profile?.yearsSmoked).toBe(12);
    expect(file.cravings[0].interventionIds).toEqual(['breathing', 'walk']);
    expect(file.cravings[0].roundCount).toBe(2);
    expect(file.cravings[0].preQuit).toBe(false);
    expect(file.cravings[0].notes).toBe('handled it');
    expect(file.reasons[0].archived).toBe(true);
    expect(file.preferences?.moneyEquivalents).toEqual([{ label: 'coffee', unitPrice: 3.5 }]);
    expect(file.preferences?.dismissedInstallHint).toBe(true);
    expect(file.preferences?.lastExportAt).toBe('2026-01-04T08:00:00Z');
  });
});

describe('validateExportFile — date fields require full ISO 8601 date-time shape', () => {
  it('rejects a bare year like "2026" even though Date.parse accepts it', () => {
    expect(Number.isNaN(Date.parse('2026'))).toBe(false); // sanity: Date.parse is lenient
    const raw = validFile({ profile: { ...validProfile, quitAt: '2026' } } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a bare number-as-string like "5" even though Date.parse accepts it', () => {
    expect(Number.isNaN(Date.parse('5'))).toBe(false); // sanity: Date.parse is lenient
    const raw = validFile({ profile: { ...validProfile, createdAt: '5' } } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a date-only string (no time component)', () => {
    const raw = validFile({ profile: { ...validProfile, updatedAt: '2026-01-01' } } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('accepts a full date-time with fractional seconds and a Z offset', () => {
    const raw = validFile({
      profile: { ...validProfile, quitAt: '2026-01-01T08:00:00.123Z' },
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).not.toThrow();
  });

  it('accepts a full date-time with a +HH:MM offset', () => {
    const raw = validFile({
      profile: { ...validProfile, quitAt: '2026-01-01T08:00:00+02:00' },
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).not.toThrow();
  });

  it('rejects an unparseable exportedAt at the top level', () => {
    const raw = validFile({ exportedAt: 'not-a-date' as string });
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a bare-year exportedAt at the top level', () => {
    const raw = validFile({ exportedAt: '2026' as string });
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });
});

describe('validateExportFile — rejects corruption', () => {
  it('throws ImportError when schemaVersion is not literal 3', () => {
    expect(() => validateExportFile(validFile({ schemaVersion: 1 as 3 }))).toThrow(ImportError);
    expect(() => validateExportFile(validFile({ schemaVersion: 2 as 3 }))).toThrow(ImportError);
    expect(() => validateExportFile(validFile({ schemaVersion: 4 as 3 }))).toThrow(ImportError);
  });

  it('throws ImportError when beliefAssessments is missing entirely', () => {
    const raw = validFile();
    delete raw.beliefAssessments;
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('throws ImportError when freedomSessions is missing entirely', () => {
    const raw = validFile();
    delete raw.freedomSessions;
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('throws ImportError when sleepSessions is missing entirely', () => {
    const raw = validFile();
    delete raw.sleepSessions;
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('throws ImportError when app is wrong', () => {
    expect(() => validateExportFile(validFile({ app: 'other' as 'quit-smoking' }))).toThrow(
      ImportError
    );
  });

  it('throws ImportError with the first issue path included in the message', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerDay: 0 } } as unknown as Partial<ExportFileV3>);
    try {
      validateExportFile(raw);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).message).toContain('cigarettesPerDay');
    }
  });

  it('rejects cigarettesPerDay out of range (0)', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerDay: 0 } } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects cigarettesPerDay out of range (201)', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerDay: 201 } } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects cigarettesPerPack out of range (0)', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerPack: 0 } } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects negative packPrice', () => {
    const raw = validFile({ profile: { ...validProfile, packPrice: -1 } } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an unparseable quitAt string', () => {
    const raw = validFile({ profile: { ...validProfile, quitAt: 'not-a-date' } } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving with an empty id', () => {
    const raw = validFile({ cravings: [{ ...validCraving, id: '' }] } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving with an unparseable startedAt', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, startedAt: 'nonsense' }],
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects initialIntensity out of range', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, initialIntensity: 11 }],
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a non-integer initialIntensity', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, initialIntensity: 5.5 }],
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an invalid trigger value', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, trigger: 'not-a-real-trigger' }],
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an invalid outcome value', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, outcome: 'not-a-real-outcome' }],
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving with an unparseable endedAt', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, endedAt: 'nonsense' }],
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving missing the outcome field entirely (it is required, not optional)', () => {
    const cravingWithoutOutcome: Record<string, unknown> = { ...validCraving };
    delete cravingWithoutOutcome.outcome;
    const raw = validFile({
      cravings: [cravingWithoutOutcome],
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an achievement unlock missing unlockedAt', () => {
    const raw = validFile({
      achievementUnlocks: [{ id: 'first-day' }],
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a reason with an empty text', () => {
    const raw = validFile({
      reasons: [{ id: 'r1', text: '', createdAt: '2026-01-01T08:00:00Z' }],
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects preferences with an invalid theme', () => {
    const raw = validFile({
      preferences: {
        id: 'singleton',
        theme: 'purple',
        showEmergingEvidence: true,
        updatedAt: '2026-01-01T08:00:00Z',
      },
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects when cravings is not an array', () => {
    const raw = validFile({ cravings: 'nope' as unknown as ExportFileV3['cravings'] });
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a completely empty object', () => {
    expect(() => validateExportFile({})).toThrow(ImportError);
  });

  it('rejects primitives', () => {
    expect(() => validateExportFile('a string')).toThrow(ImportError);
    expect(() => validateExportFile(null)).toThrow(ImportError);
    expect(() => validateExportFile(42)).toThrow(ImportError);
  });
});

const validAssessment = {
  id: 'ba-1',
  beliefId: 'relaxation',
  assessedAt: '2026-01-03T09:00:00+02:00',
  strength: 3,
  context: 'brain',
};

const validFreedomSession = {
  id: 'fs-1',
  startedAt: '2026-01-03T09:00:00+02:00',
  endedAt: '2026-01-03T09:04:00+02:00',
  kind: 'brain',
};

function withAssessment(overrides: Record<string, unknown>): Record<string, unknown> {
  return validFile({ beliefAssessments: [{ ...validAssessment, ...overrides }] } as unknown as Partial<ExportFileV3>);
}

function withFreedomSession(overrides: Record<string, unknown>): Record<string, unknown> {
  return validFile({
    freedomSessions: [{ ...validFreedomSession, ...overrides }],
  } as unknown as Partial<ExportFileV3>);
}

describe('validateExportFile — beliefAssessments', () => {
  it('accepts a fully populated assessment and preserves the optional trigger', () => {
    const file = validateExportFile(withAssessment({ trigger: 'coffee', strength: 4 }));
    expect(file.beliefAssessments).toHaveLength(1);
    expect(file.beliefAssessments[0].trigger).toBe('coffee');
    expect(file.beliefAssessments[0].strength).toBe(4);
    expect(file.beliefAssessments[0].beliefId).toBe('relaxation');
  });

  it('accepts strength 0 — "seen through" is a real, meaningful value', () => {
    const file = validateExportFile(withAssessment({ strength: 0 }));
    expect(file.beliefAssessments[0].strength).toBe(0);
  });

  it('rejects strength 5 (above the 0–4 scale)', () => {
    expect(() => validateExportFile(withAssessment({ strength: 5 }))).toThrow(ImportError);
  });

  it('rejects strength -1 (below the 0–4 scale)', () => {
    expect(() => validateExportFile(withAssessment({ strength: -1 }))).toThrow(ImportError);
  });

  it('rejects a non-integer strength', () => {
    expect(() => validateExportFile(withAssessment({ strength: 2.5 }))).toThrow(ImportError);
  });

  it('rejects an unknown beliefId', () => {
    expect(() => validateExportFile(withAssessment({ beliefId: 'smells-nice' }))).toThrow(
      ImportError
    );
  });

  it('accepts every belief in the catalog', () => {
    for (const beliefId of BELIEFS) {
      expect(() => validateExportFile(withAssessment({ beliefId }))).not.toThrow();
    }
  });

  it('enforces the context enum', () => {
    for (const context of ['brain', 'exercise', 'craving']) {
      expect(() => validateExportFile(withAssessment({ context }))).not.toThrow();
    }
    expect(() => validateExportFile(withAssessment({ context: 'dashboard' }))).toThrow(ImportError);
  });

  it('rejects an assessedAt that is not a full ISO date-time', () => {
    expect(() => validateExportFile(withAssessment({ assessedAt: '2026-01-03' }))).toThrow(
      ImportError
    );
    expect(() => validateExportFile(withAssessment({ assessedAt: '2026' }))).toThrow(ImportError);
  });

  it('rejects an invalid trigger on an assessment', () => {
    expect(() => validateExportFile(withAssessment({ trigger: 'not-a-trigger' }))).toThrow(
      ImportError
    );
  });

  it('rejects an assessment with an empty id', () => {
    expect(() => validateExportFile(withAssessment({ id: '' }))).toThrow(ImportError);
  });

  it('names the offending path in the error message', () => {
    try {
      validateExportFile(withAssessment({ strength: 9 }));
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as ImportError).message).toContain('beliefAssessments.0.strength');
    }
  });
});

describe('validateExportFile — freedomSessions', () => {
  it('accepts a minimal session and preserves every optional field when present', () => {
    const file = validateExportFile(
      withFreedomSession({ kind: 'exercise', beliefId: 'just-one', trigger: 'boredom', lessonId: 'l-3' })
    );
    expect(file.freedomSessions[0].kind).toBe('exercise');
    expect(file.freedomSessions[0].beliefId).toBe('just-one');
    expect(file.freedomSessions[0].trigger).toBe('boredom');
    expect(file.freedomSessions[0].lessonId).toBe('l-3');
  });

  it('rejects a session missing endedAt — freedom rows are written once, at completion', () => {
    const partial: Record<string, unknown> = { ...validFreedomSession };
    delete partial.endedAt;
    const raw = validFile({ freedomSessions: [partial] } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an unknown kind', () => {
    expect(() => validateExportFile(withFreedomSession({ kind: 'craving' }))).toThrow(ImportError);
  });

  it('rejects an unknown beliefId on a session', () => {
    expect(() => validateExportFile(withFreedomSession({ beliefId: 'nope' }))).toThrow(ImportError);
  });

  it('rejects a startedAt/endedAt that is not a full ISO date-time', () => {
    expect(() => validateExportFile(withFreedomSession({ startedAt: '2026' }))).toThrow(ImportError);
    expect(() => validateExportFile(withFreedomSession({ endedAt: 'nonsense' }))).toThrow(
      ImportError
    );
  });

  it('rejects an empty lessonId', () => {
    expect(() => validateExportFile(withFreedomSession({ lessonId: '' }))).toThrow(ImportError);
  });
});

describe('validateExportFile — craving beliefId (v2 field on an existing collection)', () => {
  it('round-trips a craving beliefId instead of silently stripping it', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, beliefId: 'stress-relief' }],
    } as unknown as Partial<ExportFileV3>);

    const file = validateExportFile(raw);
    expect(file.cravings[0].beliefId).toBe('stress-relief');
  });

  it('rejects an unknown craving beliefId', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, beliefId: 'not-a-belief' }],
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('leaves beliefId absent (not undefined) when the craving has none', () => {
    const file = validateExportFile(validFile({ cravings: [validCraving] } as unknown as Partial<ExportFileV3>));
    expect('beliefId' in file.cravings[0]).toBe(false);
  });
});

describe('validateExportFile — preferences locale', () => {
  const prefs = {
    id: 'singleton',
    theme: 'system',
    showEmergingEvidence: true,
    updatedAt: '2026-01-01T08:00:00Z',
  };

  it('round-trips a fi locale instead of silently stripping it', () => {
    const raw = validFile({
      preferences: { ...prefs, locale: 'fi' },
    } as unknown as Partial<ExportFileV3>);
    const file = validateExportFile(raw);
    expect(file.preferences?.locale).toBe('fi');
  });

  it('accepts an explicit en locale', () => {
    const raw = validFile({
      preferences: { ...prefs, locale: 'en' },
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).not.toThrow();
  });

  it('still accepts a legacy preferences row without a locale field', () => {
    const file = validateExportFile(validFile({ preferences: prefs } as unknown as Partial<ExportFileV3>));
    expect('locale' in (file.preferences ?? {})).toBe(false);
  });

  it('rejects an unsupported locale value', () => {
    const raw = validFile({
      preferences: { ...prefs, locale: 'sv' },
    } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });
});

describe('validateExportFile — a migrated v1-shaped file', () => {
  it('validates once MIGRATIONS[1] and MIGRATIONS[2] have supplied the three empty collections', () => {
    const migratedV1 = {
      schemaVersion: 3,
      app: 'quit-smoking',
      exportedAt: '2026-01-05T12:00:00Z',
      profile: validProfile,
      cravings: [validCraving],
      achievementUnlocks: [{ id: 'first-day', unlockedAt: '2026-01-02T08:00:00Z' }],
      reasons: [{ id: 'r1', text: 'For my health', createdAt: '2026-01-01T08:00:00Z' }],
      preferences: null,
      beliefAssessments: [],
      freedomSessions: [],
      sleepSessions: [],
    };

    const file = validateExportFile(migratedV1);
    expect(file.beliefAssessments).toEqual([]);
    expect(file.freedomSessions).toEqual([]);
    expect(file.sleepSessions).toEqual([]);
  });
});

const validSnoreEvent = {
  startMs: 1000,
  endMs: 5000,
  avgDbfs: -20,
  peakDbfs: -10,
  confidence: 0.9,
};

const validMetrics = {
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
};

const validSleepSession = {
  id: 'sleep-1',
  startedAt: '2026-01-03T23:00:00+02:00',
  endedAt: '2026-01-04T06:30:00+02:00',
  state: 'analyzed',
  analysisVersion: 'v1',
  metrics: validMetrics,
  events: [validSnoreEvent],
};

function withSleepSession(overrides: Record<string, unknown>): Record<string, unknown> {
  return validFile({
    sleepSessions: [{ ...validSleepSession, ...overrides }],
  } as unknown as Partial<ExportFileV3>);
}

describe('validateExportFile — sleepSessions', () => {
  it('accepts a fully populated sleep session and preserves every optional field', () => {
    const file = validateExportFile(withSleepSession({}));
    expect(file.sleepSessions).toHaveLength(1);
    expect(file.sleepSessions[0].analysisVersion).toBe('v1');
    expect(file.sleepSessions[0].metrics).toEqual(validMetrics);
    expect(file.sleepSessions[0].events).toEqual([validSnoreEvent]);
  });

  it('accepts a minimal recording-state session with no metrics/events/endedAt', () => {
    const raw = validFile({
      sleepSessions: [{ id: 'sleep-2', startedAt: '2026-01-03T23:00:00+02:00', state: 'recording' }],
    } as unknown as Partial<ExportFileV3>);
    const file = validateExportFile(raw);
    expect(file.sleepSessions[0].state).toBe('recording');
    expect('endedAt' in file.sleepSessions[0]).toBe(false);
  });

  it('accepts every state in the catalog', () => {
    for (const state of SLEEP_SESSION_STATES) {
      expect(() => validateExportFile(withSleepSession({ state }))).not.toThrow();
    }
  });

  it('rejects an unknown state', () => {
    expect(() => validateExportFile(withSleepSession({ state: 'sleeping' }))).toThrow(ImportError);
  });

  it('rejects a session with an empty id', () => {
    expect(() => validateExportFile(withSleepSession({ id: '' }))).toThrow(ImportError);
  });

  it('rejects a session with a missing id', () => {
    const session: Record<string, unknown> = { ...validSleepSession };
    delete session.id;
    const raw = validFile({ sleepSessions: [session] } as unknown as Partial<ExportFileV3>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an unparseable startedAt/endedAt', () => {
    expect(() => validateExportFile(withSleepSession({ startedAt: 'nonsense' }))).toThrow(
      ImportError
    );
    expect(() => validateExportFile(withSleepSession({ endedAt: 'nonsense' }))).toThrow(
      ImportError
    );
  });

  describe('snoreEvent', () => {
    it('rejects confidence above 1 (1.1)', () => {
      expect(() =>
        validateExportFile(
          withSleepSession({ events: [{ ...validSnoreEvent, confidence: 1.1 }] })
        )
      ).toThrow(ImportError);
    });

    it('rejects confidence below 0', () => {
      expect(() =>
        validateExportFile(
          withSleepSession({ events: [{ ...validSnoreEvent, confidence: -0.1 }] })
        )
      ).toThrow(ImportError);
    });

    it('rejects endMs <= startMs', () => {
      expect(() =>
        validateExportFile(
          withSleepSession({ events: [{ ...validSnoreEvent, startMs: 5000, endMs: 5000 }] })
        )
      ).toThrow(ImportError);
      expect(() =>
        validateExportFile(
          withSleepSession({ events: [{ ...validSnoreEvent, startMs: 6000, endMs: 5000 }] })
        )
      ).toThrow(ImportError);
    });

    it('rejects a positive avgDbfs/peakDbfs (relative loudness must be <= 0)', () => {
      expect(() =>
        validateExportFile(withSleepSession({ events: [{ ...validSnoreEvent, avgDbfs: 1 }] }))
      ).toThrow(ImportError);
      expect(() =>
        validateExportFile(withSleepSession({ events: [{ ...validSnoreEvent, peakDbfs: 1 }] }))
      ).toThrow(ImportError);
    });

    it('rejects a negative startMs', () => {
      expect(() =>
        validateExportFile(withSleepSession({ events: [{ ...validSnoreEvent, startMs: -1 }] }))
      ).toThrow(ImportError);
    });

    it('preserves an optional clipPath and rejects an empty one', () => {
      const file = validateExportFile(
        withSleepSession({ events: [{ ...validSnoreEvent, clipPath: 'clip-1.wav' }] })
      );
      expect(file.sleepSessions[0].events?.[0].clipPath).toBe('clip-1.wav');

      expect(() =>
        validateExportFile(withSleepSession({ events: [{ ...validSnoreEvent, clipPath: '' }] }))
      ).toThrow(ImportError);
    });
  });

  describe('sleepSessionMetrics', () => {
    it('rejects snorePercent above 100', () => {
      expect(() =>
        validateExportFile(withSleepSession({ metrics: { ...validMetrics, snorePercent: 101 } }))
      ).toThrow(ImportError);
    });

    it('rejects avgIntensity/peakIntensity outside [0,1]', () => {
      expect(() =>
        validateExportFile(withSleepSession({ metrics: { ...validMetrics, avgIntensity: 1.5 } }))
      ).toThrow(ImportError);
      expect(() =>
        validateExportFile(withSleepSession({ metrics: { ...validMetrics, peakIntensity: -0.1 } }))
      ).toThrow(ImportError);
    });

    it('rejects snoreBurden outside 0..100', () => {
      expect(() =>
        validateExportFile(withSleepSession({ metrics: { ...validMetrics, snoreBurden: 101 } }))
      ).toThrow(ImportError);
      expect(() =>
        validateExportFile(withSleepSession({ metrics: { ...validMetrics, snoreBurden: -1 } }))
      ).toThrow(ImportError);
    });

    it('rejects a negative recordingDurationMs', () => {
      expect(() =>
        validateExportFile(
          withSleepSession({ metrics: { ...validMetrics, recordingDurationMs: -1 } })
        )
      ).toThrow(ImportError);
    });
  });
});

describe('validateExportFile — preferences keepSnoreClips', () => {
  const prefs = {
    id: 'singleton',
    theme: 'system',
    showEmergingEvidence: true,
    updatedAt: '2026-01-01T08:00:00Z',
  };

  it('accepts keepSnoreClips: true and round-trips it', () => {
    const raw = validFile({
      preferences: { ...prefs, keepSnoreClips: true },
    } as unknown as Partial<ExportFileV3>);
    const file = validateExportFile(raw);
    expect(file.preferences?.keepSnoreClips).toBe(true);
  });

  it('accepts keepSnoreClips: false and round-trips it', () => {
    const raw = validFile({
      preferences: { ...prefs, keepSnoreClips: false },
    } as unknown as Partial<ExportFileV3>);
    const file = validateExportFile(raw);
    expect(file.preferences?.keepSnoreClips).toBe(false);
  });

  it('accepts preferences with keepSnoreClips absent (privacy default off)', () => {
    const file = validateExportFile(validFile({ preferences: prefs } as unknown as Partial<ExportFileV3>));
    expect('keepSnoreClips' in (file.preferences ?? {})).toBe(false);
  });
});
