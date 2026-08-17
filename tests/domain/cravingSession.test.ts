import { describe, expect, it } from 'vitest';
import type { CravingSession } from '@/domain/types';
import { buildCravingSession, withTrigger } from '@/lib/services/cravingSession';
import { toLocalIso } from '@/lib/utils/iso';

const STARTED_AT = new Date('2026-03-04T21:30:00');

function base(overrides: Partial<CravingSession> = {}): CravingSession {
  return {
    id: 'session-1',
    startedAt: toLocalIso(STARTED_AT),
    initialIntensity: 7,
    outcome: null,
    ...overrides,
  };
}

describe('buildCravingSession', () => {
  it('opens the session with the tapped intensity and a local-ISO start', () => {
    const session = buildCravingSession({
      id: 'abc',
      startedAt: STARTED_AT,
      initialIntensity: 8,
      quitAt: new Date('2026-01-01T09:00:00'),
    });
    expect(session.id).toBe('abc');
    expect(session.initialIntensity).toBe(8);
    expect(session.outcome).toBeNull();
    expect(session.startedAt).toBe(toLocalIso(STARTED_AT));
    // Round-trips to the same instant — the offset is preserved, not UTC-ised.
    expect(new Date(session.startedAt).getTime()).toBe(STARTED_AT.getTime());
  });

  it('omits the trigger KEY entirely when no trigger was chosen', () => {
    const session = buildCravingSession({
      id: 'abc',
      startedAt: STARTED_AT,
      initialIntensity: 5,
      quitAt: null,
    });
    expect('trigger' in session).toBe(false);
    expect(Object.keys(session)).not.toContain('trigger');
  });

  it('carries the trigger through when one was chosen', () => {
    const session = buildCravingSession({
      id: 'abc',
      startedAt: STARTED_AT,
      initialIntensity: 5,
      trigger: 'coffee',
      quitAt: null,
    });
    expect(session.trigger).toBe('coffee');
  });

  it('marks the session preQuit when the quit moment is still in the future', () => {
    expect(
      buildCravingSession({
        id: 'abc',
        startedAt: STARTED_AT,
        initialIntensity: 5,
        quitAt: new Date(STARTED_AT.getTime() + 86_400_000),
      }).preQuit
    ).toBe(true);
  });

  it('does not mark it preQuit once the quit moment has passed', () => {
    expect(
      buildCravingSession({
        id: 'abc',
        startedAt: STARTED_AT,
        initialIntensity: 5,
        quitAt: new Date(STARTED_AT.getTime() - 1),
      }).preQuit
    ).toBe(false);
  });

  it('treats a quit moment exactly equal to the start as already quit', () => {
    expect(
      buildCravingSession({
        id: 'abc',
        startedAt: STARTED_AT,
        initialIntensity: 5,
        quitAt: new Date(STARTED_AT.getTime()),
      }).preQuit
    ).toBe(false);
  });

  it('falls back to not-preQuit when there is no profile', () => {
    expect(
      buildCravingSession({
        id: 'abc',
        startedAt: STARTED_AT,
        initialIntensity: 5,
        quitAt: null,
      }).preQuit
    ).toBe(false);
  });
});

describe('withTrigger', () => {
  it('sets a trigger on a session that had none', () => {
    expect(withTrigger(base(), 'stress').trigger).toBe('stress');
  });

  it('replaces an existing trigger', () => {
    expect(withTrigger(base({ trigger: 'coffee' }), 'alcohol').trigger).toBe('alcohol');
  });

  it('REMOVES the key when cleared, rather than writing undefined', () => {
    const cleared = withTrigger(base({ trigger: 'coffee' }), undefined);
    expect('trigger' in cleared).toBe(false);
    expect(Object.keys(cleared)).not.toContain('trigger');
  });

  it('never mutates the input', () => {
    const original = base({ trigger: 'coffee' });
    withTrigger(original, undefined);
    withTrigger(original, 'habit');
    expect(original.trigger).toBe('coffee');
  });

  it('keeps every other field intact', () => {
    const original = base({
      trigger: 'coffee',
      interventionIds: ['breathing'],
      roundCount: 2,
      finalIntensity: 3,
    });
    const next = withTrigger(original, 'social');
    expect(next.id).toBe(original.id);
    expect(next.initialIntensity).toBe(original.initialIntensity);
    expect(next.interventionIds).toEqual(['breathing']);
    expect(next.roundCount).toBe(2);
    expect(next.finalIntensity).toBe(3);
  });
});
