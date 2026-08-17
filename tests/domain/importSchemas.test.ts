import { describe, expect, it } from 'vitest';
import { validateExportFile } from '@/lib/validation/importSchemas';
import { ImportError } from '@/domain/export/migrate';
import type { ExportFileV1 } from '@/domain/export/format';

function validFile(overrides: Partial<ExportFileV1> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    app: 'quit-smoking',
    exportedAt: '2026-01-05T12:00:00Z',
    profile: null,
    cravings: [],
    achievementUnlocks: [],
    reasons: [],
    preferences: null,
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
    expect(file.schemaVersion).toBe(1);
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
    } as unknown as Partial<ExportFileV1>);

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

describe('validateExportFile — rejects corruption', () => {
  it('throws ImportError when schemaVersion is not literal 1', () => {
    expect(() => validateExportFile(validFile({ schemaVersion: 2 as 1 }))).toThrow(ImportError);
  });

  it('throws ImportError when app is wrong', () => {
    expect(() => validateExportFile(validFile({ app: 'other' as 'quit-smoking' }))).toThrow(
      ImportError
    );
  });

  it('throws ImportError with the first issue path included in the message', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerDay: 0 } } as unknown as Partial<ExportFileV1>);
    try {
      validateExportFile(raw);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).message).toContain('cigarettesPerDay');
    }
  });

  it('rejects cigarettesPerDay out of range (0)', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerDay: 0 } } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects cigarettesPerDay out of range (201)', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerDay: 201 } } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects cigarettesPerPack out of range (0)', () => {
    const raw = validFile({ profile: { ...validProfile, cigarettesPerPack: 0 } } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects negative packPrice', () => {
    const raw = validFile({ profile: { ...validProfile, packPrice: -1 } } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an unparseable quitAt string', () => {
    const raw = validFile({ profile: { ...validProfile, quitAt: 'not-a-date' } } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving with an empty id', () => {
    const raw = validFile({ cravings: [{ ...validCraving, id: '' }] } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving with an unparseable startedAt', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, startedAt: 'nonsense' }],
    } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects initialIntensity out of range', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, initialIntensity: 11 }],
    } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a non-integer initialIntensity', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, initialIntensity: 5.5 }],
    } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an invalid trigger value', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, trigger: 'not-a-real-trigger' }],
    } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an invalid outcome value', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, outcome: 'not-a-real-outcome' }],
    } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving with an unparseable endedAt', () => {
    const raw = validFile({
      cravings: [{ ...validCraving, endedAt: 'nonsense' }],
    } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a craving missing the outcome field entirely (it is required, not optional)', () => {
    const cravingWithoutOutcome: Record<string, unknown> = { ...validCraving };
    delete cravingWithoutOutcome.outcome;
    const raw = validFile({
      cravings: [cravingWithoutOutcome],
    } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects an achievement unlock missing unlockedAt', () => {
    const raw = validFile({
      achievementUnlocks: [{ id: 'first-day' }],
    } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects a reason with an empty text', () => {
    const raw = validFile({
      reasons: [{ id: 'r1', text: '', createdAt: '2026-01-01T08:00:00Z' }],
    } as unknown as Partial<ExportFileV1>);
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
    } as unknown as Partial<ExportFileV1>);
    expect(() => validateExportFile(raw)).toThrow(ImportError);
  });

  it('rejects when cravings is not an array', () => {
    const raw = validFile({ cravings: 'nope' as unknown as ExportFileV1['cravings'] });
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
