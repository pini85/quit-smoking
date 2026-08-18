import { describe, expect, it } from 'vitest';
import type { CravingSession } from '@/domain/types';
import {
  ABANDON_AFTER_MS,
  classifyOpenSessions,
  finalizeAbandoned,
} from '@/lib/services/sessionFinalizer';

const MINUTE = 60_000;
const NOW = new Date('2026-02-01T12:00:00.000Z');

function at(minutesAgo: number): string {
  // Local-ISO-with-offset, the shape `toLocalIso` produces — parsed back by
  // `new Date()` exactly the same way real session rows are.
  return new Date(NOW.getTime() - minutesAgo * MINUTE).toISOString();
}

let idCounter = 0;
function open(minutesAgo: number, overrides: Partial<CravingSession> = {}): CravingSession {
  idCounter += 1;
  return {
    id: `open-${idCounter}`,
    startedAt: at(minutesAgo),
    initialIntensity: 6,
    outcome: null,
    ...overrides,
  };
}

describe('ABANDON_AFTER_MS', () => {
  it('is 15 minutes', () => {
    expect(ABANDON_AFTER_MS).toBe(15 * MINUTE);
  });
});

describe('classifyOpenSessions', () => {
  it('returns nothing for an empty list', () => {
    expect(classifyOpenSessions([], NOW)).toEqual({ resume: null, finalize: [] });
  });

  it('offers a fresh session for resume', () => {
    const s = open(3);
    expect(classifyOpenSessions([s], NOW)).toEqual({ resume: s, finalize: [] });
  });

  it('finalizes a session that is older than 15 minutes', () => {
    const s = open(40);
    expect(classifyOpenSessions([s], NOW)).toEqual({ resume: null, finalize: [s] });
  });

  it('treats exactly 15 minutes as abandoned (boundary is inclusive)', () => {
    const s = open(15);
    const { resume, finalize } = classifyOpenSessions([s], NOW);
    expect(resume).toBeNull();
    expect(finalize).toEqual([s]);
  });

  it('treats one millisecond under 15 minutes as resumable', () => {
    const s = open(0, {
      startedAt: new Date(NOW.getTime() - ABANDON_AFTER_MS + 1).toISOString(),
    });
    const { resume, finalize } = classifyOpenSessions([s], NOW);
    expect(resume).toBe(s);
    expect(finalize).toEqual([]);
  });

  it('resumes the single MOST RECENT fresh session and finalizes the other fresh ones', () => {
    const older = open(12);
    const newest = open(2);
    const middle = open(7);
    const { resume, finalize } = classifyOpenSessions([older, newest, middle], NOW);
    expect(resume).toBe(newest);
    expect(finalize).toHaveLength(2);
    expect(finalize).toEqual(expect.arrayContaining([older, middle]));
  });

  it('mixes stale and fresh: one resume, everything else finalized', () => {
    const stale1 = open(60);
    const fresh1 = open(10);
    const stale2 = open(16);
    const fresh2 = open(1);
    const { resume, finalize } = classifyOpenSessions([stale1, fresh1, stale2, fresh2], NOW);
    expect(resume).toBe(fresh2);
    expect(finalize).toHaveLength(3);
    expect(finalize).toEqual(expect.arrayContaining([stale1, stale2, fresh1]));
  });

  it('ignores sessions that already have an outcome', () => {
    const resolved = open(2, { outcome: 'passed' });
    const unresolved = open(90, { outcome: 'unresolved' });
    const fresh = open(4);
    const { resume, finalize } = classifyOpenSessions([resolved, unresolved, fresh], NOW);
    expect(resume).toBe(fresh);
    expect(finalize).toEqual([]);
  });

  it('never mutates its input', () => {
    const sessions = [open(2), open(30)];
    const snapshot = JSON.parse(JSON.stringify(sessions));
    classifyOpenSessions(sessions, NOW);
    expect(sessions).toEqual(snapshot);
  });

  it('tolerates a future startedAt (clock skew) by treating it as fresh', () => {
    const skewed = open(-5);
    expect(classifyOpenSessions([skewed], NOW).resume).toBe(skewed);
  });
});

describe('finalizeAbandoned', () => {
  it("marks the session 'unresolved' and ends it 15 minutes after it started", () => {
    const s = open(40);
    const finalized = finalizeAbandoned(s);
    expect(finalized.outcome).toBe('unresolved');
    expect(new Date(finalized.endedAt as string).getTime()).toBe(
      new Date(s.startedAt).getTime() + ABANDON_AFTER_MS
    );
  });

  it('keeps every other field and never mutates the original', () => {
    const s = open(40, { trigger: 'coffee', interventionIds: ['breathing'], roundCount: 2 });
    const finalized = finalizeAbandoned(s);
    expect(finalized.id).toBe(s.id);
    expect(finalized.trigger).toBe('coffee');
    expect(finalized.interventionIds).toEqual(['breathing']);
    expect(finalized.roundCount).toBe(2);
    expect(finalized.initialIntensity).toBe(s.initialIntensity);
    expect(s.outcome).toBeNull();
    expect(s.endedAt).toBeUndefined();
  });

  it('leaves finalIntensity absent — an abandoned session was never re-measured', () => {
    expect(finalizeAbandoned(open(40)).finalIntensity).toBeUndefined();
  });
});
