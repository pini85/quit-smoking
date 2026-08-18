import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDb, type QuitDb } from '@/lib/persistence/db';
import { createRepositories } from '@/lib/persistence/dexieRepositories';
import { DataStore } from '@/lib/services/dataStore';
import { SleepSessionService } from '@/lib/services/sleepSessionService';
import type { Preferences, SleepSession } from '@/domain/types';
import type {
  ClipRange,
  CutClip,
  RecorderStatus,
  RecorderStopResult,
  SleepRecorder,
} from '@/lib/recorder/types';
import { MAX_CLIPS_PER_NIGHT, CLIP_PADDING_MS } from '@/domain/snore/constants';
import { toLocalIso } from '@/lib/utils/iso';
import { makeFrames } from '../domain/helpers/snoreFrames';

// Every test gets its own isolated fake-indexeddb database, per the
// dataStore.test.ts precedent this file follows.
const openDbs: QuitDb[] = [];

function freshDb(): QuitDb {
  const db = createDb(`test-sleepsessionservice-${crypto.randomUUID()}`);
  openDbs.push(db);
  return db;
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (openDbs.length > 0) {
    const db = openDbs.pop()!;
    db.close();
    await db.delete();
  }
});

const NOW = new Date('2026-02-01T23:30:00');

function makeRow(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    id: crypto.randomUUID(),
    startedAt: toLocalIso(new Date('2026-02-01T22:00:00')),
    state: 'recording',
    ...overrides,
  };
}

/**
 * A minimal, fully in-control `SleepRecorder` fake. `recording` mirrors
 * native's own liveness state; `lastStopped` mirrors native's memory of the
 * most recently stopped session (available even once `recording` is null,
 * matching `NOT_RECORDING`'s "no active/LAST session" doc — see
 * `sleepSessionLifecycle.ts`'s `classifyPendingSessions` doc).
 */
class FakeRecorder implements SleepRecorder {
  recording: { sessionId: string; startedAtMs: number } | null = null;
  lastStopped: RecorderStopResult | null = null;
  stopDurationMs = 3_600_000;
  featuresBySession = new Map<string, unknown[]>();
  getFeaturesError = new Map<string, unknown>();
  cutClipsResult: CutClip[] = [];
  deleteRecordingError: unknown = null;

  permissions = vi.fn(async (): Promise<'granted' | 'denied' | 'prompt'> => 'granted');
  requestPermissions = vi.fn(async (): Promise<'granted' | 'denied' | 'prompt'> => 'granted');

  start = vi.fn(async (sessionId: string) => {
    if (this.recording) {
      return {
        sessionId: this.recording.sessionId,
        startedAtMs: this.recording.startedAtMs,
        alreadyRunning: true,
      };
    }
    this.recording = { sessionId, startedAtMs: NOW.getTime() };
    return { sessionId, startedAtMs: this.recording.startedAtMs, alreadyRunning: false };
  });

  stop = vi.fn(async (): Promise<RecorderStopResult> => {
    if (this.recording) {
      const result: RecorderStopResult = {
        sessionId: this.recording.sessionId,
        startedAtMs: this.recording.startedAtMs,
        endedAtMs: this.recording.startedAtMs + this.stopDurationMs,
        durationMs: this.stopDurationMs,
        interrupted: false,
      };
      this.recording = null;
      this.lastStopped = result;
      return result;
    }
    if (this.lastStopped) return this.lastStopped;
    const err = new Error('NOT_RECORDING: no active/last session to act on') as Error & { code: string };
    err.code = 'NOT_RECORDING';
    throw err;
  });

  getStatus = vi.fn(async (): Promise<RecorderStatus> => {
    if (this.recording) {
      return { recording: true, sessionId: this.recording.sessionId, startedAtMs: this.recording.startedAtMs };
    }
    return { recording: false };
  });

  getFeatures = vi.fn(async (sessionId: string) => {
    const err = this.getFeaturesError.get(sessionId);
    if (err) throw err;
    return (this.featuresBySession.get(sessionId) ?? []) as never;
  });

  cutClips = vi.fn<(sessionId: string, clips: ClipRange[]) => Promise<CutClip[]>>(
    async () => this.cutClipsResult
  );

  deleteRecording = vi.fn(async (): Promise<void> => {
    if (this.deleteRecordingError) throw this.deleteRecordingError;
  });

  getClipUrl = vi.fn((): string | null => null);

  deleteClips = vi.fn(async (): Promise<void> => {});
}

function sessionNotFoundError(): Error & { code: string } {
  const err = new Error('SESSION_NOT_FOUND') as Error & { code: string };
  err.code = 'SESSION_NOT_FOUND';
  return err;
}

interface Harness {
  db: QuitDb;
  store: DataStore;
  recorder: FakeRecorder;
  service: SleepSessionService;
  preferences: Preferences | undefined;
  quitAt: Date | null;
}

async function makeHarness(): Promise<Harness> {
  const db = freshDb();
  const repos = createRepositories(db);
  const store = new DataStore(repos);
  await store.load();
  const recorder = new FakeRecorder();
  const harness: Harness = {
    db,
    store,
    recorder,
    preferences: undefined,
    quitAt: null,
    service: undefined as unknown as SleepSessionService,
  };
  harness.service = new SleepSessionService({
    recorder,
    store,
    getSessions: () => store.getSnapshot().sleepSessions,
    getPreferences: () => harness.preferences,
    getQuitAt: () => harness.quitAt,
  });
  return harness;
}

describe('SleepSessionService.startMonitoring', () => {
  it('starts a fresh native recording and persists a recording-state row', async () => {
    const { service, recorder, store } = await makeHarness();
    const session = await service.startMonitoring(NOW);

    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(session.state).toBe('recording');
    expect(store.getSnapshot().sleepSessions).toEqual([session]);
  });

  it('double-start is a no-op: the second call adopts the same row instead of starting again', async () => {
    const { service, recorder, store } = await makeHarness();
    const first = await service.startMonitoring(NOW);
    const second = await service.startMonitoring(NOW);

    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(store.getSnapshot().sleepSessions).toHaveLength(1);
  });

  it('adopts a native-live session with no existing row (e.g. a fresh service instance)', async () => {
    const { service, recorder, store } = await makeHarness();
    recorder.recording = { sessionId: 'native-sess', startedAtMs: NOW.getTime() };

    const session = await service.startMonitoring(NOW);

    expect(recorder.start).not.toHaveBeenCalled();
    expect(session.id).toBe('native-sess');
    expect(session.state).toBe('recording');
    expect(store.getSnapshot().sleepSessions).toEqual([session]);
  });

  it('propagates a native start failure and writes no row', async () => {
    const { service, recorder, store } = await makeHarness();
    recorder.start.mockRejectedValueOnce(new Error('LOW_STORAGE'));

    await expect(service.startMonitoring(NOW)).rejects.toThrow('LOW_STORAGE');
    expect(store.getSnapshot().sleepSessions).toEqual([]);
  });
});

describe('SleepSessionService.stopMonitoring + analyzeSession', () => {
  it('happy path: persists the analyzed row BEFORE telling the recorder to delete the audio', async () => {
    const { service, recorder, store } = await makeHarness();
    const started = await service.startMonitoring(NOW);
    recorder.featuresBySession.set(started.id, []);

    const order: string[] = [];
    const originalUpdate = store.updateSleepSession.bind(store);
    vi.spyOn(store, 'updateSleepSession').mockImplementation(async (s) => {
      if (s.state === 'analyzed') order.push('persist-analyzed');
      return originalUpdate(s);
    });
    recorder.deleteRecording.mockImplementation(async () => {
      order.push('delete-recording');
    });

    const result = await service.stopMonitoring(NOW);

    expect(result?.state).toBe('analyzed');
    expect(order).toEqual(['persist-analyzed', 'delete-recording']);
    expect(recorder.deleteRecording).toHaveBeenCalledWith(started.id, false);
    expect(store.getSnapshot().sleepSessions[0].state).toBe('analyzed');
  });

  it('double-stop is a no-op: the second call returns null without calling recorder.stop() again', async () => {
    const { service, recorder } = await makeHarness();
    const started = await service.startMonitoring(NOW);
    recorder.featuresBySession.set(started.id, []);

    const first = await service.stopMonitoring(NOW);
    expect(first).not.toBeNull();
    expect(recorder.stop).toHaveBeenCalledTimes(1);

    const second = await service.stopMonitoring(NOW);
    expect(second).toBeNull();
    expect(recorder.stop).toHaveBeenCalledTimes(1);
  });

  it('an analysis error (not SESSION_NOT_FOUND) leaves the row "recorded" and never calls deleteRecording; a retry then succeeds', async () => {
    const { service, recorder, store } = await makeHarness();
    const started = await service.startMonitoring(NOW);
    recorder.getFeaturesError.set(started.id, new Error('boom'));

    // stopMonitoring's own promise rejects (analyzeSession's error propagates
    // uncaught, per the brief: the caller/UI is expected to offer a retry) —
    // but the row was already persisted as 'recorded' by the time it throws.
    await expect(service.stopMonitoring(NOW)).rejects.toThrow('boom');
    expect(recorder.deleteRecording).not.toHaveBeenCalled();
    expect(store.getSnapshot().sleepSessions[0].state).toBe('recorded');

    // Retry: the transient error clears, analysis now succeeds.
    recorder.getFeaturesError.delete(started.id);
    recorder.featuresBySession.set(started.id, []);
    const rowBeforeRetry = store.getSnapshot().sleepSessions[0];
    const retried = await service.analyzeSession(rowBeforeRetry);

    expect(retried.state).toBe('analyzed');
    expect(recorder.deleteRecording).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().sleepSessions[0].state).toBe('analyzed');
  });

  it('SESSION_NOT_FOUND marks the row "failed"', async () => {
    const { service, recorder, store } = await makeHarness();
    const started = await service.startMonitoring(NOW);
    recorder.getFeaturesError.set(started.id, sessionNotFoundError());

    const result = await service.stopMonitoring(NOW);

    expect(result?.state).toBe('failed');
    expect(recorder.deleteRecording).not.toHaveBeenCalled();
    expect(store.getSnapshot().sleepSessions[0].state).toBe('failed');
  });

  it('clips are cut only when keepSnoreClips is true, attached to the matching events, and left off otherwise', async () => {
    const harness = await makeHarness();
    const { service, recorder } = harness;
    const started = await service.startMonitoring(NOW);

    const QUIET = { dbfs: -50, lowBandRatio: 0.2, midBandRatio: 0.2 };
    const RHYTHMIC = { dbfs: -35, lowBandRatio: 0.7, midBandRatio: 0.1 };
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 20_000,
      silence: QUIET,
      bursts: [
        { startMs: 5000, durationMs: 1000, ...RHYTHMIC },
        { startMs: 9000, durationMs: 1000, ...RHYTHMIC },
        { startMs: 13000, durationMs: 1000, ...RHYTHMIC },
      ],
    });
    recorder.featuresBySession.set(started.id, frames);

    // keepSnoreClips absent (falsy default) -> no clip cutting at all.
    const noPrefResult = await service.stopMonitoring(NOW);
    expect(noPrefResult?.events?.length).toBeGreaterThan(0);
    expect(recorder.cutClips).not.toHaveBeenCalled();
    expect(noPrefResult?.events?.every((e) => e.clipPath === undefined)).toBe(true);
  });

  it('cuts and attaches clip paths when keepSnoreClips is true', async () => {
    const harness = await makeHarness();
    const { service, recorder } = harness;
    harness.preferences = {
      id: 'singleton',
      theme: 'system',
      showEmergingEvidence: true,
      keepSnoreClips: true,
      updatedAt: NOW.toISOString(),
    };
    const started = await service.startMonitoring(NOW);

    const QUIET = { dbfs: -50, lowBandRatio: 0.2, midBandRatio: 0.2 };
    const RHYTHMIC = { dbfs: -35, lowBandRatio: 0.7, midBandRatio: 0.1 };
    const frames = makeFrames({
      hopMs: 100,
      totalMs: 20_000,
      silence: QUIET,
      bursts: [
        { startMs: 5000, durationMs: 1000, ...RHYTHMIC },
        { startMs: 9000, durationMs: 1000, ...RHYTHMIC },
        { startMs: 13000, durationMs: 1000, ...RHYTHMIC },
      ],
    });
    recorder.featuresBySession.set(started.id, frames);
    recorder.cutClipsResult = [{ id: '0', path: '/clips/0.m4a' }];

    const result = await service.stopMonitoring(NOW);

    expect(recorder.cutClips).toHaveBeenCalledTimes(1);
    const [, clips] = recorder.cutClips.mock.calls[0] as [string, ClipRange[]];
    expect(clips).toHaveLength(1);
    expect(clips[0].startMs).toBe(Math.max(0, 5000 - CLIP_PADDING_MS));
    expect(result?.events?.[0].clipPath).toBe('/clips/0.m4a');
    expect(recorder.deleteRecording).toHaveBeenCalledWith(started.id, true);
  });

  it('caps clip extraction at MAX_CLIPS_PER_NIGHT and clamps left-padding at 0 near the recording start', async () => {
    const harness = await makeHarness();
    const { service, recorder } = harness;
    harness.preferences = {
      id: 'singleton',
      theme: 'system',
      showEmergingEvidence: true,
      keepSnoreClips: true,
      updatedAt: NOW.toISOString(),
    };
    const started = await service.startMonitoring(NOW);

    const QUIET = { dbfs: -50, lowBandRatio: 0.2, midBandRatio: 0.2 };
    const RHYTHMIC = { dbfs: -35, lowBandRatio: 0.7, midBandRatio: 0.1 };
    const RUN_SPACING = 25_000;
    const RUN_COUNT = MAX_CLIPS_PER_NIGHT + 2; // more events than the cap allows
    const bursts: { startMs: number; durationMs: number; dbfs: number; lowBandRatio: number; midBandRatio: number }[] = [];
    // First run starts at 1000ms so its onset (startMs=1000) is within
    // CLIP_PADDING_MS (1500ms) of the recording start, exercising the clamp.
    for (let run = 0; run < RUN_COUNT; run++) {
      const runStart = 1000 + run * RUN_SPACING;
      bursts.push(
        { startMs: runStart, durationMs: 1000, ...RHYTHMIC },
        { startMs: runStart + 4000, durationMs: 1000, ...RHYTHMIC },
        { startMs: runStart + 8000, durationMs: 1000, ...RHYTHMIC }
      );
    }
    const totalMs = 1000 + (RUN_COUNT - 1) * RUN_SPACING + 9000 + 5000;
    const frames = makeFrames({ hopMs: 100, totalMs, silence: QUIET, bursts });
    recorder.featuresBySession.set(started.id, frames);
    recorder.cutClipsResult = Array.from({ length: MAX_CLIPS_PER_NIGHT }, (_, i) => ({
      id: String(i),
      path: `/clips/${i}.m4a`,
    }));

    const result = await service.stopMonitoring(NOW);

    expect(result?.events?.length).toBe(RUN_COUNT);
    expect(recorder.cutClips).toHaveBeenCalledTimes(1);
    const [, clips] = recorder.cutClips.mock.calls[0] as [string, ClipRange[]];
    expect(clips).toHaveLength(MAX_CLIPS_PER_NIGHT);
    // The very first event's onset is at 1000ms; padding would go negative
    // (1000 - 1500 = -500) and must clamp to 0.
    expect(clips[0].startMs).toBe(0);
  });
});

describe('SleepSessionService.recoverOnLaunch', () => {
  it('adopts a pending row that matches a currently-live native session', async () => {
    const { service, recorder, store } = await makeHarness();
    const row = makeRow({ id: 'sess-live', state: 'recording' });
    await store.addSleepSession(row);
    recorder.recording = { sessionId: 'sess-live', startedAtMs: new Date(row.startedAt).getTime() };

    const result = await service.recoverOnLaunch(NOW);

    expect(result.live?.id).toBe('sess-live');
    expect(store.getSnapshot().sleepSessions).toHaveLength(1);
    expect(store.getSnapshot().sleepSessions[0].state).toBe('recording');
  });

  it('finalizes and analyzes a pending row whose native session already stopped (interrupted)', async () => {
    const { service, recorder, store } = await makeHarness();
    const row = makeRow({ id: 'sess-stopped', state: 'recording' });
    await store.addSleepSession(row);
    const startedAtMs = new Date(row.startedAt).getTime();
    recorder.lastStopped = {
      sessionId: 'sess-stopped',
      startedAtMs,
      endedAtMs: startedAtMs + 3_600_000,
      durationMs: 3_600_000,
      interrupted: true,
    };
    recorder.featuresBySession.set('sess-stopped', []);

    const result = await service.recoverOnLaunch(NOW);

    expect(result.live).toBeUndefined();
    const stored = store.getSnapshot().sleepSessions[0];
    expect(stored.state).toBe('analyzed');
    expect(stored.interrupted).toBe(true);
  });

  it('runs a retry analysis pass over pending "recorded" rows', async () => {
    const { service, recorder, store } = await makeHarness();
    const row = makeRow({
      id: 'sess-recorded',
      state: 'recorded',
      endedAt: toLocalIso(new Date('2026-02-01T23:00:00')),
    });
    await store.addSleepSession(row);
    recorder.featuresBySession.set('sess-recorded', []);

    await service.recoverOnLaunch(NOW);

    expect(store.getSnapshot().sleepSessions[0].state).toBe('analyzed');
  });

  it('marks a pending row with no native knowledge at all as failed, endedAt pinned to startedAt', async () => {
    const { service, store } = await makeHarness();
    const row = makeRow({ id: 'sess-lost', state: 'recording' });
    await store.addSleepSession(row);
    // recorder never recorded and has no lastStopped memory -> NOT_RECORDING.

    await service.recoverOnLaunch(NOW);

    const stored = store.getSnapshot().sleepSessions[0];
    expect(stored.state).toBe('failed');
    expect(stored.endedAt).toBe(stored.startedAt);
  });

  it('isolates a retry-analysis failure to that one session, leaving it "recorded" for a future retry', async () => {
    const { service, recorder, store } = await makeHarness();
    const row = makeRow({
      id: 'sess-broken',
      state: 'recorded',
      endedAt: toLocalIso(new Date('2026-02-01T23:00:00')),
    });
    await store.addSleepSession(row);
    recorder.getFeaturesError.set('sess-broken', new Error('boom'));

    await expect(service.recoverOnLaunch(NOW)).resolves.toBeDefined();

    expect(store.getSnapshot().sleepSessions[0].state).toBe('recorded');
  });
});

describe('SleepSessionService.deleteSession / deleteAllSessions', () => {
  it('deleteSession deletes referenced clips before removing the row', async () => {
    const { service, recorder, store } = await makeHarness();
    const row = makeRow({
      id: 'sess-1',
      state: 'analyzed',
      endedAt: toLocalIso(new Date('2026-02-01T23:00:00')),
      analysisVersion: 'ts-1.0.0',
      metrics: {
        recordingDurationMs: 3_600_000,
        snoreDurationMs: 0,
        snorePercent: 0,
        eventCount: 1,
        eventsPerHour: 1,
        avgIntensity: 0,
        peakIntensity: 0,
        longestEpisodeMs: 0,
        avgEventDurationMs: 0,
        snoreBurden: 0,
      },
      events: [
        { startMs: 0, endMs: 1000, avgDbfs: -30, peakDbfs: -25, confidence: 0.9, clipPath: '/clips/a.m4a' },
      ],
    });
    await store.addSleepSession(row);

    const order: string[] = [];
    recorder.deleteClips.mockImplementation(async () => {
      order.push('delete-clips');
    });
    const originalRemove = store.removeSleepSession.bind(store);
    vi.spyOn(store, 'removeSleepSession').mockImplementation(async (id) => {
      order.push('remove-row');
      return originalRemove(id);
    });

    await service.deleteSession('sess-1');

    expect(order).toEqual(['delete-clips', 'remove-row']);
    expect(recorder.deleteClips).toHaveBeenCalledWith(['/clips/a.m4a']);
    expect(store.getSnapshot().sleepSessions).toEqual([]);
  });

  it('deleteSession with no clip paths skips deleteClips entirely', async () => {
    const { service, recorder, store } = await makeHarness();
    const row = makeRow({ id: 'sess-2', state: 'recording' });
    await store.addSleepSession(row);

    await service.deleteSession('sess-2');

    expect(recorder.deleteClips).not.toHaveBeenCalled();
    expect(store.getSnapshot().sleepSessions).toEqual([]);
  });

  it('deleteAllSessions deletes every referenced clip across all rows, then clears the table', async () => {
    const { service, recorder, store } = await makeHarness();
    const rowA = makeRow({
      id: 'a',
      state: 'analyzed',
      events: [{ startMs: 0, endMs: 1000, avgDbfs: -30, peakDbfs: -25, confidence: 0.9, clipPath: '/clips/a.m4a' }],
    });
    const rowB = makeRow({
      id: 'b',
      state: 'analyzed',
      events: [{ startMs: 0, endMs: 1000, avgDbfs: -30, peakDbfs: -25, confidence: 0.9, clipPath: '/clips/b.m4a' }],
    });
    await store.addSleepSession(rowA);
    await store.addSleepSession(rowB);

    await service.deleteAllSessions();

    expect(recorder.deleteClips).toHaveBeenCalledWith(['/clips/a.m4a', '/clips/b.m4a']);
    expect(store.getSnapshot().sleepSessions).toEqual([]);
  });
});
