import { describe, expect, it } from 'vitest';
import type { SleepSession, SleepSessionMetrics } from '@/domain/types';
import type { RecorderStatus } from '@/lib/recorder/types';
import {
  ANALYZING_WINDOW_HOURS,
  RESULTS_WINDOW_HOURS,
  deriveView,
} from '@/components/sleep/deriveView';
import { toLocalIso } from '@/lib/utils/iso';

const METRICS: SleepSessionMetrics = {
  recordingDurationMs: 27_720_000,
  snoreDurationMs: 1_800_000,
  snorePercent: 6.5,
  eventCount: 40,
  eventsPerHour: 5.2,
  avgIntensity: -32,
  peakIntensity: -20,
  longestEpisodeMs: 120_000,
  avgEventDurationMs: 45_000,
  snoreBurden: 21,
};

function row(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    id: 'sess-1',
    startedAt: toLocalIso(new Date('2026-02-01T23:18:00')),
    state: 'recording',
    ...overrides,
  };
}

const IDLE: RecorderStatus = { phase: 'idle' };

describe('deriveView — loading and active', () => {
  it('is loading until native status has resolved', () => {
    expect(deriveView(null, [], new Date('2026-02-02T08:00:00'))).toEqual({ phase: 'loading' });
  });

  it('is active only when native itself says it is recording, using native startedAtMs', () => {
    const startedAtMs = new Date('2026-02-01T23:18:00').getTime();
    const view = deriveView(
      { phase: 'recording', sessionId: 'sess-1', startedAtMs },
      [row()],
      new Date('2026-02-02T02:00:00')
    );
    expect(view).toEqual({ phase: 'active', startedAtMs });
  });

  it('falls back to the stored row’s startedAt when native omits startedAtMs', () => {
    const stored = row();
    const view = deriveView(
      { phase: 'recording', sessionId: 'sess-1' },
      [stored],
      new Date('2026-02-02T02:00:00')
    );
    expect(view).toEqual({ phase: 'active', startedAtMs: new Date(stored.startedAt).getTime() });
  });
});

describe('deriveView — a natively-ended session never renders as live', () => {
  // The C1 dead-end: the notification's Stop action (or an error/low-storage
  // stop) ends the session natively while /sleep is open. Native reports
  // 'stopped', the stored row is still 'recording' — the hero must move off
  // 'active' rather than pretend a recording is still running.
  it('native "stopped" + a still-"recording" row is not active', () => {
    const stopped: RecorderStatus = {
      phase: 'stopped',
      sessionId: 'sess-1',
      endedAtMs: new Date('2026-02-02T07:00:00').getTime(),
      interrupted: false,
    };
    const view = deriveView(stopped, [row({ state: 'recording' })], new Date('2026-02-02T07:01:00'));
    expect(view.phase).not.toBe('active');
    // Native's own endedAtMs (07:00) — not the row's 23:18 startedAt — is what
    // says this night just ended, so it is still fresh enough to sit in the
    // analyzing slot while recovery claims and analyzes it.
    expect(view.phase).toBe('analyzing');
  });

  it('a "recording" row native stopped LONG ago is stale and reverts to pre-sleep', () => {
    const stopped: RecorderStatus = {
      phase: 'stopped',
      sessionId: 'sess-1',
      endedAtMs: new Date('2026-02-02T07:00:00').getTime(),
      interrupted: true,
    };
    expect(deriveView(stopped, [row({ state: 'recording' })], new Date('2026-02-02T12:00:00'))).toEqual({
      phase: 'pre-sleep',
    });
  });

  it('native "idle" + a still-"recording" row is not active either', () => {
    const view = deriveView(IDLE, [row({ state: 'recording' })], new Date('2026-02-01T23:20:00'));
    expect(view.phase).not.toBe('active');
  });
});

describe('deriveView — the analyzing window is an escape hatch', () => {
  it('a fresh "recorded" row holds the analyzing slot (where its retry lives)', () => {
    const stored = row({
      state: 'recorded',
      endedAt: toLocalIso(new Date('2026-02-02T07:00:00')),
    });
    const view = deriveView(IDLE, [stored], new Date('2026-02-02T07:05:00'));
    expect(view).toEqual({ phase: 'analyzing', session: stored });
  });

  it('a STALE "recorded" row falls back to pre-sleep so Start is reachable again', () => {
    // The persistent-EXTRACTION_FAILED case: retry never succeeds, so without
    // this fallback the hero would hold a card with no Start button forever.
    const stored = row({
      state: 'recorded',
      endedAt: toLocalIso(new Date('2026-02-02T07:00:00')),
    });
    const justPast = new Date(
      new Date('2026-02-02T07:00:00').getTime() + ANALYZING_WINDOW_HOURS * 3_600_000 + 60_000
    );
    expect(deriveView(IDLE, [stored], justPast)).toEqual({ phase: 'pre-sleep' });
  });

  it('a stale "recording" row (anchored on startedAt, having no endedAt) also falls back to pre-sleep', () => {
    const stored = row({ state: 'recording' });
    const view = deriveView(IDLE, [stored], new Date('2026-02-02T07:00:00'));
    expect(view).toEqual({ phase: 'pre-sleep' });
  });

  it('the analyzing window is measured from endedAt, not startedAt, for a "recorded" row', () => {
    // 23:18 -> 07:00 is a >7h night: anchoring on startedAt would call this
    // row stale the moment it was stored.
    const stored = row({
      state: 'recorded',
      endedAt: toLocalIso(new Date('2026-02-02T07:00:00')),
    });
    expect(deriveView(IDLE, [stored], new Date('2026-02-02T08:30:00')).phase).toBe('analyzing');
  });
});

describe('deriveView — the results window', () => {
  it('shows a 23:18 -> 07:00 night’s results all morning (anchored on endedAt, not the start date)', () => {
    const stored = row({
      state: 'analyzed',
      endedAt: toLocalIso(new Date('2026-02-02T07:00:00')),
      analysisVersion: 'ts-1.0.0',
      metrics: METRICS,
    });
    expect(deriveView(IDLE, [stored], new Date('2026-02-02T07:01:00'))).toEqual({
      phase: 'results',
      session: stored,
    });
    expect(deriveView(IDLE, [stored], new Date('2026-02-02T18:00:00'))).toEqual({
      phase: 'results',
      session: stored,
    });
  });

  it('reverts to pre-sleep at the results cutoff, so tonight can be started', () => {
    const endedAt = new Date('2026-02-02T07:00:00');
    const stored = row({
      state: 'analyzed',
      endedAt: toLocalIso(endedAt),
      analysisVersion: 'ts-1.0.0',
      metrics: METRICS,
    });
    const justInside = new Date(endedAt.getTime() + RESULTS_WINDOW_HOURS * 3_600_000 - 60_000);
    const justPast = new Date(endedAt.getTime() + RESULTS_WINDOW_HOURS * 3_600_000 + 60_000);
    expect(deriveView(IDLE, [stored], justInside).phase).toBe('results');
    expect(deriveView(IDLE, [stored], justPast)).toEqual({ phase: 'pre-sleep' });
  });

  it('a "failed" row with no endedAt anchors on startedAt and still shows its honest results card', () => {
    const stored = row({ state: 'failed' });
    expect(deriveView(IDLE, [stored], new Date('2026-02-02T01:00:00'))).toEqual({
      phase: 'results',
      session: stored,
    });
  });

  it('picks the newest row by startedAt regardless of input order', () => {
    const older = row({
      id: 'older',
      startedAt: toLocalIso(new Date('2026-01-30T23:00:00')),
      state: 'analyzed',
      endedAt: toLocalIso(new Date('2026-01-31T07:00:00')),
      analysisVersion: 'ts-1.0.0',
      metrics: METRICS,
    });
    const newer = row({
      id: 'newer',
      startedAt: toLocalIso(new Date('2026-02-01T23:18:00')),
      state: 'analyzed',
      endedAt: toLocalIso(new Date('2026-02-02T07:00:00')),
      analysisVersion: 'ts-1.0.0',
      metrics: METRICS,
    });
    const view = deriveView(IDLE, [older, newer], new Date('2026-02-02T08:00:00'));
    expect(view).toEqual({ phase: 'results', session: newer });
  });

  it('no rows at all is pre-sleep', () => {
    expect(deriveView(IDLE, [], new Date('2026-02-02T22:00:00'))).toEqual({ phase: 'pre-sleep' });
  });
});
