import { describe, expect, it } from 'vitest';
import { SLEEP_SESSION_STATES, isSleepSessionState } from '@/domain/types';

describe('SLEEP_SESSION_STATES', () => {
  it('has no duplicates', () => {
    expect(new Set(SLEEP_SESSION_STATES).size).toBe(SLEEP_SESSION_STATES.length);
  });
});

describe('isSleepSessionState', () => {
  it('accepts every member of SLEEP_SESSION_STATES', () => {
    for (const state of SLEEP_SESSION_STATES) {
      expect(isSleepSessionState(state)).toBe(true);
    }
  });

  it('rejects non-string values', () => {
    expect(isSleepSessionState(undefined)).toBe(false);
    expect(isSleepSessionState(null)).toBe(false);
    expect(isSleepSessionState(42)).toBe(false);
    expect(isSleepSessionState({})).toBe(false);
    expect(isSleepSessionState(['recording'])).toBe(false);
  });

  it('rejects unknown strings', () => {
    expect(isSleepSessionState('')).toBe(false);
    expect(isSleepSessionState('paused')).toBe(false);
    expect(isSleepSessionState('Recording')).toBe(false);
  });
});
