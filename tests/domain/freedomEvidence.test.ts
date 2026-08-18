import { describe, expect, it } from 'vitest';
import type { CravingSession } from '@/domain/types';
import { triggerProof, beliefEncounters, proofLine } from '@/domain/freedom/evidence';

let idCounter = 0;
function mkSession(overrides: Partial<CravingSession> = {}): CravingSession {
  idCounter += 1;
  return {
    id: `session-${idCounter}`,
    startedAt: '2026-01-01T12:00:00Z',
    initialIntensity: 5,
    outcome: 'passed',
    ...overrides,
  };
}

describe('triggerProof', () => {
  it('delegates to alreadyProved: null below the 3-resolved gate', () => {
    const sessions = [
      mkSession({ trigger: 'stress', outcome: 'passed' }),
      mkSession({ trigger: 'stress', outcome: 'passed' }),
    ];
    expect(triggerProof(sessions, 'stress')).toBeNull();
  });

  it('delegates to alreadyProved: grounded at exactly 3 resolved', () => {
    const sessions = [
      mkSession({ trigger: 'stress', outcome: 'passed' }),
      mkSession({ trigger: 'stress', outcome: 'still-there' }),
      mkSession({ trigger: 'stress', outcome: 'smoked' }),
    ];
    expect(triggerProof(sessions, 'stress')).toEqual({ total: 3, passed: 2 });
  });
});

describe('beliefEncounters', () => {
  it('counts only resolved sessions tagged with the given beliefId', () => {
    const sessions = [
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
      mkSession({ beliefId: 'reward', outcome: null }), // open — excluded
      mkSession({ beliefId: 'reward', outcome: 'unresolved' }), // excluded from both
      mkSession({ beliefId: 'reward', outcome: 'smoked' }), // resolved but not passed
      mkSession({ beliefId: 'relaxation', outcome: 'passed' }), // different belief — excluded
    ];
    expect(beliefEncounters(sessions, 'reward')).toEqual({
      total: 2,
      passedWithoutSmoking: 1,
    });
  });

  it('includes preQuit sessions in the count', () => {
    const sessions = [
      mkSession({ beliefId: 'reward', outcome: 'passed', preQuit: true }),
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
    ];
    expect(beliefEncounters(sessions, 'reward')).toEqual({
      total: 2,
      passedWithoutSmoking: 2,
    });
  });

  it('returns zeros for a belief with no matching sessions', () => {
    expect(beliefEncounters([], 'reward')).toEqual({ total: 0, passedWithoutSmoking: 0 });
  });

  it('gate at exactly 2 resolved is below grounding threshold, 3 reaches it (via proofLine)', () => {
    const twoResolved = [
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
    ];
    expect(beliefEncounters(twoResolved, 'reward').total).toBe(2);
    const threeResolved = [...twoResolved, mkSession({ beliefId: 'reward', outcome: 'passed' })];
    expect(beliefEncounters(threeResolved, 'reward').total).toBe(3);
  });
});

describe('proofLine', () => {
  it('returns the exact neutral fallback when nothing is grounded', () => {
    const result = proofLine([], 'reward');
    expect(result).toEqual({
      grounded: false,
      text: "We're still learning how this one shows up for you.",
    });
  });

  it('stays ungrounded at exactly 2 resolved belief-tagged sessions and no trigger backup', () => {
    const sessions = [
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
      mkSession({ beliefId: 'reward', outcome: 'smoked' }),
    ];
    const result = proofLine(sessions, 'reward');
    expect(result.grounded).toBe(false);
    expect(result.text).toBe("We're still learning how this one shows up for you.");
  });

  it('becomes grounded at exactly 3 resolved belief-tagged sessions, with real numbers', () => {
    const sessions = [
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
      mkSession({ beliefId: 'reward', outcome: 'smoked' }),
    ];
    const result = proofLine(sessions, 'reward');
    expect(result.grounded).toBe(true);
    expect(result.text).toBe("You've been here 3 times. 2 passed without smoking.");
  });

  it('excludes unresolved sessions from the belief-tag gate and count', () => {
    const sessions = [
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
      mkSession({ beliefId: 'reward', outcome: 'unresolved' }),
      mkSession({ beliefId: 'reward', outcome: null }),
    ];
    // only 2 resolved -> below gate -> fallback, even though 4 rows exist
    const result = proofLine(sessions, 'reward');
    expect(result.grounded).toBe(false);
  });

  it('includes preQuit sessions toward the belief-tag gate', () => {
    const sessions = [
      mkSession({ beliefId: 'reward', outcome: 'passed', preQuit: true }),
      mkSession({ beliefId: 'reward', outcome: 'passed', preQuit: true }),
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
    ];
    const result = proofLine(sessions, 'reward');
    expect(result.grounded).toBe(true);
    expect(result.text).toBe("You've been here 3 times. 3 passed without smoking.");
  });

  it('falls back to the trigger-derived path when belief tags are below the gate', () => {
    // 'stress-relief' belief has relatedTriggers: ['stress', 'emotional'] — no belief-tagged
    // sessions at all here, but 3 resolved 'stress' cravings clear the trigger gate.
    const sessions = [
      mkSession({ trigger: 'stress', outcome: 'passed' }),
      mkSession({ trigger: 'stress', outcome: 'passed' }),
      mkSession({ trigger: 'stress', outcome: 'smoked' }),
    ];
    const result = proofLine(sessions, 'stress-relief');
    expect(result.grounded).toBe(true);
    expect(result.text).toBe(
      "You've been in stress moments like this 3 times. 2 passed without smoking."
    );
  });

  it('prefers the belief-tag path over the trigger-derived path when both clear the gate', () => {
    const sessions = [
      // belief-tagged: 3 resolved, all passed
      mkSession({ beliefId: 'stress-relief', outcome: 'passed' }),
      mkSession({ beliefId: 'stress-relief', outcome: 'passed' }),
      mkSession({ beliefId: 'stress-relief', outcome: 'passed' }),
      // trigger-only: also clears the trigger gate, but with different numbers
      mkSession({ trigger: 'stress', outcome: 'smoked' }),
      mkSession({ trigger: 'stress', outcome: 'smoked' }),
      mkSession({ trigger: 'stress', outcome: 'smoked' }),
    ];
    const result = proofLine(sessions, 'stress-relief');
    expect(result.grounded).toBe(true);
    expect(result.text).toBe("You've been here 3 times. 3 passed without smoking.");
  });

  it('never fabricates numbers below the gate: below-gate belief tags plus below-gate triggers stays ungrounded', () => {
    const sessions = [
      mkSession({ beliefId: 'reward', outcome: 'passed' }),
      mkSession({ trigger: 'habit', outcome: 'passed' }),
      mkSession({ trigger: 'emotional', outcome: 'passed' }),
    ];
    const result = proofLine(sessions, 'reward');
    expect(result.grounded).toBe(false);
    expect(result.text).toBe("We're still learning how this one shows up for you.");
  });
});
