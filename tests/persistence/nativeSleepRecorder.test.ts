/**
 * Field-by-field coverage of the native `SleepRecorder` adapter — the one
 * place where the frozen Capacitor plugin wire shapes
 * (`lib/native/snoreMonitor.ts`) are renamed into the port's shapes
 * (`lib/recorder/types.ts`). Every rename here is a silent-data-loss hazard:
 * `startedAt` -> `startedAtMs` etc. are pure string swaps that TypeScript
 * cannot catch dropping, and one dropped field (`notifications`) is exactly
 * the bug I3 fixed.
 *
 * The plugin module and `@capacitor/core` are both mocked, so this runs with
 * no device, no bridge, and no real files.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFeaturesFile } from '../domain/helpers/featuresFileFixture';

const plugin = {
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  getStatus: vi.fn(),
  extractFeatures: vi.fn(),
  cutClips: vi.fn(),
  deleteSessionAudio: vi.fn(),
  deleteClips: vi.fn(),
};

const convertFileSrc = vi.fn((path: string) => `capacitor-file://${path}`);

vi.mock('@/lib/native/snoreMonitor', () => ({ SnoreMonitor: plugin }));
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    convertFileSrc: (path: string) => convertFileSrc(path),
    isNativePlatform: () => true,
    getPlatform: () => 'android',
  },
}));

// Imported after the mocks are registered (vi.mock is hoisted, but keeping
// the import here makes the ordering dependency explicit).
const { nativeSleepRecorder } = await import('@/lib/recorder/nativeSleepRecorder');

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('nativeSleepRecorder — permissions', () => {
  it('passes BOTH microphone and notifications through checkPermissions', async () => {
    plugin.checkPermissions.mockResolvedValue({ microphone: 'granted', notifications: 'denied' });

    await expect(nativeSleepRecorder.permissions()).resolves.toEqual({
      microphone: 'granted',
      notifications: 'denied',
    });
  });

  it('passes BOTH microphone and notifications through requestPermissions', async () => {
    plugin.requestPermissions.mockResolvedValue({ microphone: 'denied', notifications: 'prompt' });

    await expect(nativeSleepRecorder.requestPermissions()).resolves.toEqual({
      microphone: 'denied',
      notifications: 'prompt',
    });
    expect(plugin.checkPermissions).not.toHaveBeenCalled();
  });
});

describe('nativeSleepRecorder — start and stop', () => {
  it('maps startRecording’s startedAt to startedAtMs and keeps alreadyRunning', async () => {
    plugin.startRecording.mockResolvedValue({
      sessionId: 'sess-1',
      startedAt: 1_700_000_000_000,
      alreadyRunning: true,
    });

    await expect(nativeSleepRecorder.start('sess-1')).resolves.toEqual({
      sessionId: 'sess-1',
      startedAtMs: 1_700_000_000_000,
      alreadyRunning: true,
    });
    expect(plugin.startRecording).toHaveBeenCalledWith({ sessionId: 'sess-1' });
  });

  it('maps every stopRecording field the port carries, and drops the two it does not', async () => {
    plugin.stopRecording.mockResolvedValue({
      sessionId: 'sess-1',
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_028_000_000,
      durationMs: 27_000_000, // deliberately < endedAt - startedAt (interrupted)
      interrupted: true,
      stopReason: 'notification',
      segmentCount: 24,
    });

    const result = await nativeSleepRecorder.stop();

    expect(result).toEqual({
      sessionId: 'sess-1',
      startedAtMs: 1_700_000_000_000,
      endedAtMs: 1_700_028_000_000,
      durationMs: 27_000_000,
      interrupted: true,
    });
    // `stopReason`/`segmentCount` are intentionally not part of the port.
    expect(Object.keys(result).sort()).toEqual(
      ['durationMs', 'endedAtMs', 'interrupted', 'sessionId', 'startedAtMs'].sort()
    );
  });
});

describe('nativeSleepRecorder — getStatus phase mapping', () => {
  it('idle: phase only, every optional field undefined', async () => {
    plugin.getStatus.mockResolvedValue({ phase: 'idle' });

    await expect(nativeSleepRecorder.getStatus()).resolves.toEqual({
      phase: 'idle',
      sessionId: undefined,
      startedAtMs: undefined,
      endedAtMs: undefined,
      interrupted: undefined,
    });
  });

  it('recording: sessionId plus startedAt renamed to startedAtMs (elapsedMs is not carried)', async () => {
    plugin.getStatus.mockResolvedValue({
      phase: 'recording',
      sessionId: 'sess-1',
      startedAt: 1_700_000_000_000,
      elapsedMs: 3_600_000,
    });

    const status = await nativeSleepRecorder.getStatus();

    expect(status.phase).toBe('recording');
    expect(status.sessionId).toBe('sess-1');
    expect(status.startedAtMs).toBe(1_700_000_000_000);
    expect(status).not.toHaveProperty('elapsedMs');
  });

  it('stopped: carries endedAt -> endedAtMs and interrupted, the stopped-only fields', async () => {
    plugin.getStatus.mockResolvedValue({
      phase: 'stopped',
      sessionId: 'sess-1',
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_028_000_000,
      elapsedMs: 28_000_000,
      interrupted: true,
      stopReason: 'error',
    });

    const status = await nativeSleepRecorder.getStatus();

    expect(status).toEqual({
      phase: 'stopped',
      sessionId: 'sess-1',
      startedAtMs: 1_700_000_000_000,
      endedAtMs: 1_700_028_000_000,
      interrupted: true,
    });
  });

  it('stopped with interrupted false is carried as false, not dropped as falsy', async () => {
    plugin.getStatus.mockResolvedValue({
      phase: 'stopped',
      sessionId: 'sess-1',
      endedAt: 1_700_028_000_000,
      interrupted: false,
    });

    await expect(nativeSleepRecorder.getStatus()).resolves.toMatchObject({ interrupted: false });
  });
});

describe('nativeSleepRecorder — getFeatures', () => {
  it('extracts, converts the path to a webview-readable URL, fetches it, and parses the frames', async () => {
    plugin.extractFeatures.mockResolvedValue({
      featuresPath: '/data/user/0/app.unsmoke/files/snore/sessions/sess-1/features.bin',
      frameCount: 2,
      hopMs: 64,
      sampleRate: 16000,
    });
    const buffer = buildFeaturesFile(
      [
        { rmsDbfs: -30, band70_300: 0.6, band300_800: 0.1, band800_3000: 0.05 },
        { rmsDbfs: -25, band70_300: 0.7, band300_800: 0.1, band800_3000: 0.05 },
      ],
      { sampleRate: 16000, hopSamples: 1600 }
    );
    const fetchMock = vi.fn(async () => ({ arrayBuffer: async () => buffer }));
    vi.stubGlobal('fetch', fetchMock);

    const frames = await nativeSleepRecorder.getFeatures('sess-1');

    expect(plugin.extractFeatures).toHaveBeenCalledWith({ sessionId: 'sess-1' });
    // A raw file path is not fetchable from the webview — it MUST go through
    // convertFileSrc first, or getFeatures fails on every real device.
    expect(convertFileSrc).toHaveBeenCalledWith(
      '/data/user/0/app.unsmoke/files/snore/sessions/sess-1/features.bin'
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'capacitor-file:///data/user/0/app.unsmoke/files/snore/sessions/sess-1/features.bin'
    );
    expect(frames).toEqual([
      { tMs: 0, rmsDbfs: -30, lowBandRatio: expect.closeTo(0.6, 5), midBandRatio: expect.closeTo(0.05, 5) },
      { tMs: 100, rmsDbfs: -25, lowBandRatio: expect.closeTo(0.7, 5), midBandRatio: expect.closeTo(0.05, 5) },
    ]);
  });

  it('propagates a features file the parser rejects rather than returning empty frames', async () => {
    // Zero frames is a meaningful signal upstream ("provably unanalyzable" —
    // it deletes the audio), so a corrupt file must NEVER be flattened into it.
    plugin.extractFeatures.mockResolvedValue({
      featuresPath: '/files/snore/sessions/sess-1/features.bin',
      frameCount: 1,
      hopMs: 64,
      sampleRate: 16000,
    });
    const corrupt = buildFeaturesFile(
      [{ rmsDbfs: -30, band70_300: 0.5, band300_800: 0.1, band800_3000: 0.05 }],
      { magic: 0xdeadbeef }
    );
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => corrupt })));

    await expect(nativeSleepRecorder.getFeatures('sess-1')).rejects.toThrow(/magic/i);
  });
});

describe('nativeSleepRecorder — clips and deletion', () => {
  it('cutClips forwards the ranges verbatim and maps only id + path back', async () => {
    plugin.cutClips.mockResolvedValue({
      clips: [
        { id: '0', path: '/files/snore/clips/sess-1/0.m4a', durationMs: 4000 },
        { id: '3', path: '/files/snore/clips/sess-1/3.m4a', durationMs: 3500 },
      ],
    });
    const ranges = [
      { id: '0', startMs: 3500, endMs: 7500 },
      { id: '3', startMs: 60_000, endMs: 63_500 },
    ];

    const clips = await nativeSleepRecorder.cutClips('sess-1', ranges);

    expect(plugin.cutClips).toHaveBeenCalledWith({ sessionId: 'sess-1', clips: ranges });
    expect(clips).toEqual([
      { id: '0', path: '/files/snore/clips/sess-1/0.m4a' },
      { id: '3', path: '/files/snore/clips/sess-1/3.m4a' },
    ]);
  });

  it('deleteRecording forwards keepClips both ways', async () => {
    plugin.deleteSessionAudio.mockResolvedValue(undefined);

    await nativeSleepRecorder.deleteRecording('sess-1', true);
    await nativeSleepRecorder.deleteRecording('sess-2', false);

    expect(plugin.deleteSessionAudio.mock.calls).toEqual([
      [{ sessionId: 'sess-1', keepClips: true }],
      [{ sessionId: 'sess-2', keepClips: false }],
    ]);
  });

  it('deleteClips forwards the whole batch in one call', async () => {
    plugin.deleteClips.mockResolvedValue(undefined);

    await nativeSleepRecorder.deleteClips(['/files/snore/clips/a/0.m4a', '/elsewhere/b.m4a']);

    expect(plugin.deleteClips).toHaveBeenCalledWith({
      paths: ['/files/snore/clips/a/0.m4a', '/elsewhere/b.m4a'],
    });
  });

  it('getClipUrl converts a file path into a webview-playable URL', () => {
    expect(nativeSleepRecorder.getClipUrl('/files/snore/clips/a/0.m4a')).toBe(
      'capacitor-file:///files/snore/clips/a/0.m4a'
    );
  });
});
