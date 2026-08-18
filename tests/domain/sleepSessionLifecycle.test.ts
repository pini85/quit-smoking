import { describe, expect, it } from 'vitest';
import type { SleepSession, SleepSessionMetrics, SnoreEvent } from '@/domain/types';
import type { SnoreAnalysis } from '@/domain/snore/types';
import type { RecorderStopResult } from '@/lib/recorder/types';
import {
  buildSleepSession,
  finalizeRecorded,
  markAnalyzed,
  markFailed,
  classifyPendingSessions,
} from '@/lib/services/sleepSessionLifecycle';

const STARTED = new Date('2026-02-01T23:00:00');
const QUIT_AFTER = new Date('2026-02-02T06:00:00'); // later than STARTED
const QUIT_BEFORE = new Date('2026-01-01T06:00:00'); // earlier than STARTED

function stopResult(overrides: Partial<RecorderStopResult> = {}): RecorderStopResult {
  return {
    sessionId: 'sess-1',
    startedAtMs: STARTED.getTime(),
    endedAtMs: STARTED.getTime() + 3_600_000,
    durationMs: 3_600_000,
    interrupted: false,
    ...overrides,
  };
}

function recordedSession(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    id: 'sess-1',
    startedAt: STARTED.toISOString(),
    state: 'recorded',
    endedAt: new Date(STARTED.getTime() + 3_600_000).toISOString(),
    ...overrides,
  };
}

function event(overrides: Partial<SnoreEvent> & Pick<SnoreEvent, 'startMs' | 'endMs'>): SnoreEvent {
  return { avgDbfs: -30, peakDbfs: -25, confidence: 0.7, ...overrides };
}

function metrics(overrides: Partial<SleepSessionMetrics> = {}): SleepSessionMetrics {
  return {
    recordingDurationMs: 3_600_000,
    snoreDurationMs: 0,
    snorePercent: 0,
    eventCount: 0,
    eventsPerHour: 0,
    avgIntensity: 0,
    peakIntensity: 0,
    longestEpisodeMs: 0,
    avgEventDurationMs: 0,
    snoreBurden: 0,
    ...overrides,
  };
}

describe('buildSleepSession', () => {
  it('builds a recording-state row with no preQuit when quitAt is null', () => {
    const session = buildSleepSession({ id: 'a', startedAt: STARTED, quitAt: null });
    expect(session).toEqual({
      id: 'a',
      startedAt: expect.any(String),
      state: 'recording',
      preQuit: false,
    });
  });

  it('pins preQuit=true when startedAt is before quitAt', () => {
    const session = buildSleepSession({ id: 'a', startedAt: STARTED, quitAt: QUIT_AFTER });
    expect(session.preQuit).toBe(true);
  });

  it('pins preQuit=false when startedAt is after quitAt', () => {
    const session = buildSleepSession({ id: 'a', startedAt: STARTED, quitAt: QUIT_BEFORE });
    expect(session.preQuit).toBe(false);
  });

  it('never has an endedAt (still recording)', () => {
    const session = buildSleepSession({ id: 'a', startedAt: STARTED, quitAt: null });
    expect(session.endedAt).toBeUndefined();
  });
});

describe('finalizeRecorded', () => {
  it('moves to recorded, stamping endedAt and interrupted from the recorder result', () => {
    const session = buildSleepSession({ id: 'sess-1', startedAt: STARTED, quitAt: null });
    const result = stopResult({ interrupted: true });
    const finalized = finalizeRecorded(session, result);
    expect(finalized.state).toBe('recorded');
    expect(finalized.interrupted).toBe(true);
    expect(new Date(finalized.endedAt as string).getTime()).toBe(result.endedAtMs);
  });

  it('preserves fields already on the row (e.g. preQuit)', () => {
    const session = buildSleepSession({ id: 'sess-1', startedAt: STARTED, quitAt: QUIT_AFTER });
    const finalized = finalizeRecorded(session, stopResult());
    expect(finalized.preQuit).toBe(true);
  });
});

describe('markAnalyzed', () => {
  it('moves to analyzed, stamping analysisVersion and storing metrics + events', () => {
    const session = recordedSession();
    const analysis: SnoreAnalysis = {
      events: [event({ startMs: 0, endMs: 1000 })],
      noiseFloorDbfs: -50,
      analysisVersion: 'ts-1.0.0',
    };
    const m = metrics({ eventCount: 1 });
    const analyzed = markAnalyzed(session, analysis, m);

    expect(analyzed.state).toBe('analyzed');
    expect(analyzed.analysisVersion).toBe('ts-1.0.0');
    expect(analyzed.metrics).toEqual(m);
    expect(analyzed.events).toEqual(analysis.events);
  });

  it('stores an empty events array as-is (a quiet, fully-analyzed night)', () => {
    const session = recordedSession();
    const analysis: SnoreAnalysis = { events: [], noiseFloorDbfs: -55, analysisVersion: 'ts-1.0.0' };
    const analyzed = markAnalyzed(session, analysis, metrics());
    expect(analyzed.events).toEqual([]);
    expect(analyzed.state).toBe('analyzed');
  });
});

describe('markFailed', () => {
  it('pins endedAt to the given Date when the row has none yet (a lost "recording" row)', () => {
    const session = buildSleepSession({ id: 'a', startedAt: STARTED, quitAt: null });
    expect(session.endedAt).toBeUndefined();
    const failed = markFailed(session, STARTED);
    expect(failed.state).toBe('failed');
    expect(new Date(failed.endedAt as string).getTime()).toBe(STARTED.getTime());
  });

  it('keeps the existing endedAt untouched when the row already has one', () => {
    const session = recordedSession();
    const originalEndedAt = session.endedAt;
    const failed = markFailed(session, new Date('2099-01-01T00:00:00'));
    expect(failed.state).toBe('failed');
    expect(failed.endedAt).toBe(originalEndedAt);
  });
});

describe('classifyPendingSessions', () => {
  it('buckets nothing for an empty pending list', () => {
    expect(classifyPendingSessions([], { recording: false })).toEqual({
      live: null,
      finalize: [],
      retryAnalysis: [],
      lost: [],
    });
  });

  it('adopts a recording row whose id matches a live native session', () => {
    const row = buildSleepSession({ id: 'sess-1', startedAt: STARTED, quitAt: null });
    const result = classifyPendingSessions([row], {
      recording: true,
      sessionId: 'sess-1',
      startedAtMs: STARTED.getTime(),
    });
    expect(result.live).toBe(row);
    expect(result.finalize).toEqual([]);
    expect(result.lost).toEqual([]);
  });

  it('finalizes a recording row whose id matches a native stopped-with-result session', () => {
    const row = buildSleepSession({ id: 'sess-1', startedAt: STARTED, quitAt: null });
    const endedAtMs = STARTED.getTime() + 5_000_000;
    const result = classifyPendingSessions([row], { recording: false }, {
      sessionId: 'sess-1',
      endedAtMs,
      interrupted: true,
    });
    expect(result.finalize).toEqual([{ session: row, endedAtMs, interrupted: true }]);
    expect(result.live).toBeNull();
    expect(result.lost).toEqual([]);
  });

  it('defaults interrupted to false when the native record omits it', () => {
    const row = buildSleepSession({ id: 'sess-1', startedAt: STARTED, quitAt: null });
    const result = classifyPendingSessions([row], { recording: false }, {
      sessionId: 'sess-1',
      endedAtMs: STARTED.getTime() + 1000,
    });
    expect(result.finalize).toEqual([{ session: row, endedAtMs: STARTED.getTime() + 1000, interrupted: false }]);
  });

  it('marks a recording row with no native knowledge at all as lost', () => {
    const row = buildSleepSession({ id: 'sess-1', startedAt: STARTED, quitAt: null });
    const result = classifyPendingSessions([row], { recording: false });
    expect(result.lost).toEqual([row]);
    expect(result.live).toBeNull();
    expect(result.finalize).toEqual([]);
  });

  it('marks a recording row as lost when native is recording a DIFFERENT session', () => {
    const row = buildSleepSession({ id: 'sess-1', startedAt: STARTED, quitAt: null });
    const result = classifyPendingSessions([row], {
      recording: true,
      sessionId: 'sess-OTHER',
      startedAtMs: STARTED.getTime(),
    });
    expect(result.lost).toEqual([row]);
    expect(result.live).toBeNull();
  });

  it('buckets a recorded row into retryAnalysis regardless of native status', () => {
    const row = recordedSession();
    const result = classifyPendingSessions([row], { recording: false });
    expect(result.retryAnalysis).toEqual([row]);
    expect(result.lost).toEqual([]);
  });

  it('handles a mix of rows across every bucket in one call', () => {
    const live = buildSleepSession({ id: 'live', startedAt: STARTED, quitAt: null });
    const toFinalize = buildSleepSession({ id: 'stopped', startedAt: STARTED, quitAt: null });
    const recorded = recordedSession({ id: 'recorded-1' });
    const lost = buildSleepSession({ id: 'lost-1', startedAt: STARTED, quitAt: null });

    const result = classifyPendingSessions(
      [live, toFinalize, recorded, lost],
      { recording: true, sessionId: 'live', startedAtMs: STARTED.getTime() },
      { sessionId: 'stopped', endedAtMs: STARTED.getTime() + 1000, interrupted: false }
    );

    expect(result.live).toBe(live);
    expect(result.finalize).toEqual([
      { session: toFinalize, endedAtMs: STARTED.getTime() + 1000, interrupted: false },
    ]);
    expect(result.retryAnalysis).toEqual([recorded]);
    expect(result.lost).toEqual([lost]);
  });

  it('clock-skew guard: clamps a native endedAtMs before startedAt up to startedAt (zero-length), never throwing', () => {
    const row = buildSleepSession({ id: 'sess-1', startedAt: STARTED, quitAt: null });
    expect(() =>
      classifyPendingSessions([row], { recording: false }, {
        sessionId: 'sess-1',
        endedAtMs: STARTED.getTime() - 10_000,
        interrupted: false,
      })
    ).not.toThrow();

    const result = classifyPendingSessions([row], { recording: false }, {
      sessionId: 'sess-1',
      endedAtMs: STARTED.getTime() - 10_000,
      interrupted: false,
    });
    expect(result.finalize[0].endedAtMs).toBe(STARTED.getTime());
  });

  it('treats a nativeStopped record with no endedAtMs as a zero-length finalize', () => {
    const row = buildSleepSession({ id: 'sess-1', startedAt: STARTED, quitAt: null });
    const result = classifyPendingSessions([row], { recording: false }, { sessionId: 'sess-1' });
    expect(result.finalize).toEqual([{ session: row, endedAtMs: STARTED.getTime(), interrupted: false }]);
  });
});
