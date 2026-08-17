import { describe, expect, it } from 'vitest';
import type { CravingSession, Trigger } from '@/domain/types';
import { pickInterventions, INTERVENTION_POOL } from '@/lib/services/interventionPicker';

let idCounter = 0;
function mkSession(overrides: Partial<CravingSession> = {}): CravingSession {
  idCounter += 1;
  return {
    id: `session-${idCounter}`,
    startedAt: '2026-01-01T12:00:00+00:00',
    initialIntensity: 5,
    outcome: 'passed',
    ...overrides,
  };
}

/** Three RESOLVED sessions with `trigger` — the `alreadyProved` gate. */
function provedHistory(trigger: Trigger): CravingSession[] {
  return [
    mkSession({ trigger, outcome: 'passed' }),
    mkSession({ trigger, outcome: 'much-weaker' }),
    mkSession({ trigger, outcome: 'smoked' }),
  ];
}

describe('INTERVENTION_POOL', () => {
  it('is the documented least-recently-used pool, in order', () => {
    expect(INTERVENTION_POOL).toEqual([
      'urge-surf',
      'delay',
      'scene-change',
      'water',
      'breathing',
    ]);
  });
});

describe('pickInterventions — high intensity (>= 7)', () => {
  it('leads with breathing', () => {
    const picked = pickInterventions({
      intensity: 7,
      sessions: [],
      reasonsCount: 0,
      recentInterventionIds: [],
    });
    expect(picked.primary).toBe('breathing');
  });

  it('leads with breathing at intensity 10 too', () => {
    const picked = pickInterventions({
      intensity: 10,
      sessions: [],
      reasonsCount: 0,
      recentInterventionIds: [],
    });
    expect(picked.primary).toBe('breathing');
  });

  it('falls back to urge-surf when breathing was the MOST recent one used', () => {
    const picked = pickInterventions({
      intensity: 9,
      sessions: [],
      reasonsCount: 0,
      recentInterventionIds: ['breathing', 'water'],
    });
    expect(picked.primary).toBe('urge-surf');
  });

  it('still leads with breathing when breathing was used but is not the most recent', () => {
    const picked = pickInterventions({
      intensity: 9,
      sessions: [],
      reasonsCount: 0,
      recentInterventionIds: ['water', 'breathing'],
    });
    expect(picked.primary).toBe('breathing');
  });

  it('never returns the same kind twice', () => {
    const picked = pickInterventions({
      intensity: 8,
      sessions: [],
      reasonsCount: 3,
      recentInterventionIds: ['breathing'],
    });
    expect(picked.alternative).not.toBe(picked.primary);
  });
});

describe('pickInterventions — normal intensity (< 7), LRU', () => {
  it('with no history at all, uses pool order', () => {
    const picked = pickInterventions({
      intensity: 4,
      sessions: [],
      reasonsCount: 0,
      recentInterventionIds: [],
    });
    expect(picked.primary).toBe('urge-surf');
    expect(picked.alternative).toBe('delay');
  });

  it('skips recently-used kinds in favour of never-used ones', () => {
    const picked = pickInterventions({
      intensity: 4,
      sessions: [],
      reasonsCount: 0,
      recentInterventionIds: ['urge-surf', 'delay'],
    });
    expect(picked.primary).toBe('scene-change');
    expect(picked.alternative).toBe('water');
  });

  it('when everything has been used, the STALEST (last in the recency list) wins', () => {
    // most recent first => 'delay' is the least recently used of the five
    const picked = pickInterventions({
      intensity: 3,
      sessions: [],
      reasonsCount: 0,
      recentInterventionIds: ['breathing', 'water', 'scene-change', 'urge-surf', 'delay'],
    });
    expect(picked.primary).toBe('delay');
    expect(picked.alternative).toBe('urge-surf');
  });

  it('includes reasons in the pool when the user has reasons', () => {
    const picked = pickInterventions({
      intensity: 4,
      sessions: [],
      reasonsCount: 2,
      recentInterventionIds: ['urge-surf', 'delay', 'scene-change', 'water', 'breathing'],
    });
    // 'reasons' was never used => stalest of all
    expect(picked.primary).toBe('reasons');
  });

  it("NEVER returns 'reasons' when the user has none", () => {
    for (const recent of [
      [],
      ['urge-surf', 'delay', 'scene-change', 'water', 'breathing'],
      ['breathing'],
    ]) {
      const picked = pickInterventions({
        intensity: 4,
        sessions: [],
        reasonsCount: 0,
        recentInterventionIds: recent,
      });
      expect(picked.primary).not.toBe('reasons');
      expect(picked.alternative).not.toBe('reasons');
    }
  });

  it('the alternative is the NEXT least-recently-used, never the primary', () => {
    const picked = pickInterventions({
      intensity: 2,
      sessions: [],
      reasonsCount: 0,
      recentInterventionIds: ['breathing', 'water', 'scene-change'],
    });
    // never used: urge-surf, delay (pool order breaks the tie)
    expect(picked.primary).toBe('urge-surf');
    expect(picked.alternative).toBe('delay');
  });
});

describe('pickInterventions — the proof gate', () => {
  it("puts 'proof' in the ALTERNATIVE slot when the trigger is already proved", () => {
    const picked = pickInterventions({
      intensity: 4,
      trigger: 'coffee',
      sessions: provedHistory('coffee'),
      reasonsCount: 0,
      recentInterventionIds: [],
    });
    expect(picked.alternative).toBe('proof');
    expect(picked.primary).toBe('urge-surf');
  });

  it("NEVER puts 'proof' in the primary slot, even at high intensity", () => {
    const picked = pickInterventions({
      intensity: 10,
      trigger: 'stress',
      sessions: provedHistory('stress'),
      reasonsCount: 0,
      recentInterventionIds: [],
    });
    expect(picked.primary).toBe('breathing');
    expect(picked.alternative).toBe('proof');
  });

  it("never returns 'proof' without the gate (fewer than 3 resolved with that trigger)", () => {
    const picked = pickInterventions({
      intensity: 4,
      trigger: 'coffee',
      sessions: [mkSession({ trigger: 'coffee' }), mkSession({ trigger: 'coffee' })],
      reasonsCount: 0,
      recentInterventionIds: [],
    });
    expect(picked.primary).not.toBe('proof');
    expect(picked.alternative).not.toBe('proof');
  });

  it('never returns proof when no trigger is set, however rich the history', () => {
    const picked = pickInterventions({
      intensity: 4,
      sessions: provedHistory('coffee'),
      reasonsCount: 0,
      recentInterventionIds: [],
    });
    expect(picked.primary).not.toBe('proof');
    expect(picked.alternative).not.toBe('proof');
  });

  it('does not count unresolved/open sessions toward the gate', () => {
    const picked = pickInterventions({
      intensity: 4,
      trigger: 'coffee',
      sessions: [
        mkSession({ trigger: 'coffee', outcome: 'passed' }),
        mkSession({ trigger: 'coffee', outcome: 'unresolved' }),
        mkSession({ trigger: 'coffee', outcome: null }),
      ],
      reasonsCount: 0,
      recentInterventionIds: [],
    });
    expect(picked.alternative).not.toBe('proof');
  });
});

describe('pickInterventions — invariants', () => {
  const triggers: (Trigger | undefined)[] = [undefined, 'coffee', 'stress'];
  const recents = [
    [],
    ['breathing'],
    ['urge-surf', 'delay'],
    ['reasons', 'proof', 'breathing', 'water', 'scene-change', 'urge-surf', 'delay'],
  ];

  it('always returns two distinct, gate-legal kinds for every input combination', () => {
    for (let intensity = 1; intensity <= 10; intensity++) {
      for (const trigger of triggers) {
        for (const reasonsCount of [0, 4]) {
          for (const recent of recents) {
            for (const sessions of [[], provedHistory('coffee')]) {
              const picked = pickInterventions({
                intensity,
                trigger,
                sessions,
                reasonsCount,
                recentInterventionIds: recent,
              });
              expect(picked.primary).not.toBe(picked.alternative);
              expect(picked.primary).not.toBe('proof');
              if (reasonsCount === 0) {
                expect(picked.primary).not.toBe('reasons');
                expect(picked.alternative).not.toBe('reasons');
              }
              const proved = trigger !== undefined && sessions.some((s) => s.trigger === trigger);
              if (!proved) {
                expect(picked.alternative).not.toBe('proof');
              }
            }
          }
        }
      }
    }
  });
});
