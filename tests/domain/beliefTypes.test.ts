import { describe, expect, it } from 'vitest';
import { BELIEFS, isBelief } from '@/domain/types';

describe('BELIEFS', () => {
  it('has no duplicates', () => {
    expect(new Set(BELIEFS).size).toBe(BELIEFS.length);
  });
});

describe('isBelief', () => {
  it('accepts every member of BELIEFS', () => {
    for (const belief of BELIEFS) {
      expect(isBelief(belief)).toBe(true);
    }
  });

  it('rejects "freedom" — it is a MilestoneCategory, not a Belief', () => {
    expect(isBelief('freedom')).toBe(false);
  });

  it('rejects trigger-id spellings such as "boredom" (the belief is "boredom-relief")', () => {
    expect(isBelief('boredom')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isBelief(undefined)).toBe(false);
    expect(isBelief(null)).toBe(false);
    expect(isBelief(42)).toBe(false);
    expect(isBelief({})).toBe(false);
    expect(isBelief(['relaxation'])).toBe(false);
  });

  it('rejects unknown strings', () => {
    expect(isBelief('')).toBe(false);
    expect(isBelief('not-a-belief')).toBe(false);
    expect(isBelief('Relaxation')).toBe(false);
  });
});
