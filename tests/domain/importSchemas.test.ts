import { describe, expect, it } from 'vitest';
import { validateExportFile } from '@/lib/validation/importSchemas';
import { ImportError } from '@/domain/export/migrate';
import type { ExportFileV2 } from '@/domain/export/format';
import { BELIEFS } from '@/domain/types';

// `validateExportFile` only ever sees ALREADY-migrated files, so the shape it
// must accept is v2 — a v1 file reaches it only after MIGRATIONS[1] has added
// the two freedom collections.
function validFile(overrides: Partial<ExportFileV2> = {}): Record<string, unknown> {
  return {
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
    expect(file.schemaVersion).toBe(2);
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
    } as unknown as Partial<ExportFileV2>);

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
    const raw = validFile({ profile: { ...validProfile, quitAt: '2026' } } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a bare number-as-string like "5" even though Date.parse accepts it', () => {
    expect(Number.isNaN(Date.parse('5'))).toBe(false); // sanity: Date.parse is lenient
    const raw = validFile({ profile: { ...validProfile, createdAt: '5' } } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a date-only string (no time component)', () => {
    const raw = validFile({ profile: { ...validProfile, updatedAt: '2026-01-01' } } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('accepts a full date-time with fractional seconds and a Z offset', () => {
    const raw = validFile({
      profile: { ...validProfile, quitAt: '2026-01-01T08:00:00.123Z' },
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).not.toThrow();
  });

  it('accepts a full date-time with a +HH:MM offset', () => {
    const raw = validFile({
      profile: { ...validProfile, quitAt: '2026-01-01T08:00:00+02:00' },
    } as unknown as Partial<ExportFileV2>);
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
  it('throws ImportError when schemaVersion is not literal 2', () => {
    expect(() => validateExportFile(validFile({ schemaVersion: 1 as 2 }))).toThrow(ImportError);
    expect(() => validateExportFile(validFile({ schemaVersion: 3 as 2 }))).toThrow(ImportError);
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

  it('throws ImportError when app is wrong', () => {
    expect(() => validateExportFile(validFile({ app: 'other' as 'quit-smoking' }))).toThrow(
      ImportError
    );
  });

  it('throws ImportError with the first issue path included in the message', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerDay: 0 } } as unknown as Partial<ExportFileV2>);
    try {
      validateExportFile(raw);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).message).toContain('cigarettesPerDay');
    }
  });

  it('rejects cigarettesPerDay out of range (0)', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerDay: 0 } } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects cigarettesPerDay out of range (201)', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerDay: 201 } } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects cigarettesPerPack out of range (0)', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerPack: 0 } } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects negative packPrice', () => {
    const raw = validFile({ profile: { ...validProfile, packPrice: -1 } } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an unparseable quitAt string', () => {
    const raw = validFile({ profile: { ...validProfile, quitAt: 'not-a-date' } } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving with an empty id', () => {
    const raw = validFile({ cravings: [{ ...validCraving, id: '' }] } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving with an unparseable startedAt', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, startedAt: 'nonsense' }],
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects initialIntensity out of range', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, initialIntensity: 11 }],
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a non-integer initialIntensity', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, initialIntensity: 5.5 }],
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an invalid trigger value', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, trigger: 'not-a-real-trigger' }],
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an invalid outcome value', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, outcome: 'not-a-real-outcome' }],
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving with an unparseable endedAt', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, endedAt: 'nonsense' }],
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving missing the outcome field entirely (it is required, not optional)', () => {
    const cravingWithoutOutcome: Record<string, unknown> = { ...validCraving };
    delete cravingWithoutOutcome.outcome;
    const raw = validFile({
      cravings: [cravingWithoutOutcome],
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an achievement unlock missing unlockedAt', () => {
    const raw = validFile({
      achievementUnlocks: [{ id: 'first-day' }],
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a reason with an empty text', () => {
    const raw = validFile({
      reasons: [{ id: 'r1', text: '', createdAt: '2026-01-01T08:00:00Z' }],
    } as unknown as Partial<ExportFileV2>);
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
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects when cravings is not an array', () => {
    const raw = validFile({ cravings: 'nope' as unknown as ExportFileV2['cravings'] });
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
  return validFile({ beliefAssessments: [{ ...validAssessment, ...overrides }] } as unknown as Partial<ExportFileV2>);
}

function withFreedomSession(overrides: Record<string, unknown>): Record<string, unknown> {
  return validFile({
    freedomSessions: [{ ...validFreedomSession, ...overrides }],
  } as unknown as Partial<ExportFileV2>);
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
    const raw = validFile({ freedomSessions: [partial] } as unknown as Partial<ExportFileV2>);
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
    } as unknown as Partial<ExportFileV2>);

    const file = validateExportFile(raw);
    expect(file.cravings[0].beliefId).toBe('stress-relief');
  });

  it('rejects an unknown craving beliefId', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, beliefId: 'not-a-belief' }],
    } as unknown as Partial<ExportFileV2>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('leaves beliefId absent (not undefined) when the craving has none', () => {
    const file = validateExportFile(validFile({ cravings: [validCraving] } as unknown as Partial<ExportFileV2>));
    expect('beliefId' in file.cravings[0]).toBe(false);
  });
});

describe('validateExportFile — a migrated v1-shaped file', () => {
  it('validates once MIGRATIONS[1] has supplied the two empty collections', () => {
    const migratedV1 = {
      schemaVersion: 2,
      app: 'quit-smoking',
      exportedAt: '2026-01-05T12:00:00Z',
      profile: validProfile,
      cravings: [validCraving],
      achievementUnlocks: [{ id: 'first-day', unlockedAt: '2026-01-02T08:00:00Z' }],
      reasons: [{ id: 'r1', text: 'For my health', createdAt: '2026-01-01T08:00:00Z' }],
      preferences: null,
      beliefAssessments: [],
      freedomSessions: [],
    };

    const file = validateExportFile(migratedV1);
    expect(file.beliefAssessments).toEqual([]);
    expect(file.freedomSessions).toEqual([]);
  });
});
