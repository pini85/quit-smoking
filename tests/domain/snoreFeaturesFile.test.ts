import { describe, expect, it } from 'vitest';
import { parseFeaturesFile } from '@/domain/snore/featuresFile';
import { buildFeaturesFile } from './helpers/featuresFileFixture';
import {
  FEATURES_GOLDEN_BYTES,
  FEATURES_GOLDEN_FRAMES,
  FEATURES_GOLDEN_META,
} from './fixtures/features-golden.bin';

function bufOf(bytes: Uint8Array): ArrayBuffer {
  // Copy into a fresh, exactly-sized ArrayBuffer (Uint8Array.buffer can be
  // larger/shared depending on how the array was constructed).
  return bytes.slice().buffer;
}

describe('parseFeaturesFile — golden fixture', () => {
  it('parses the hand-assembled golden fixture to the expected frames', () => {
    const result = parseFeaturesFile(bufOf(FEATURES_GOLDEN_BYTES));
    expect(result.sampleRate).toBe(FEATURES_GOLDEN_META.sampleRate);
    expect(result.hopMs).toBe(FEATURES_GOLDEN_META.hopMs);
    expect(result.startedAtEpochMs).toBe(FEATURES_GOLDEN_META.startedAtEpochMs);
    expect(result.frames).toEqual(FEATURES_GOLDEN_FRAMES);
  });

  it('skips band300_800 — it never appears in the parsed frames', () => {
    const result = parseFeaturesFile(bufOf(FEATURES_GOLDEN_BYTES));
    for (const frame of result.frames) {
      expect(Object.keys(frame).sort()).toEqual(
        ['lowBandRatio', 'midBandRatio', 'rmsDbfs', 'tMs'].sort()
      );
    }
  });
});

describe('parseFeaturesFile — hopMs derivation', () => {
  it('derives hopMs from hopSamples/sampleRate rather than hardcoding it (1600/16000*1000 = 100ms)', () => {
    const buf = buildFeaturesFile(
      [
        { rmsDbfs: -30, band70_300: 0.6, band300_800: 0.1, band800_3000: 0.05 },
        { rmsDbfs: -25, band70_300: 0.6, band300_800: 0.1, band800_3000: 0.05 },
      ],
      { sampleRate: 16000, hopSamples: 1600 }
    );
    const result = parseFeaturesFile(buf);
    expect(result.hopMs).toBe(100);
    expect(result.frames.map((f) => f.tMs)).toEqual([0, 100]);
  });
});

describe('parseFeaturesFile — error cases', () => {
  it('throws on a buffer shorter than the 28-byte header', () => {
    const buf = buildFeaturesFile([{ rmsDbfs: -30, band70_300: 0.5, band300_800: 0.1, band800_3000: 0.05 }], {
      truncateToBytes: 10,
    });
    expect(() => parseFeaturesFile(buf)).toThrow(/header|short/i);
  });

  it('throws on a bad magic number', () => {
    const buf = buildFeaturesFile([{ rmsDbfs: -30, band70_300: 0.5, band300_800: 0.1, band800_3000: 0.05 }], {
      magic: 0xdeadbeef,
    });
    expect(() => parseFeaturesFile(buf)).toThrow(/magic/i);
  });

  it('throws on an unsupported formatVersion', () => {
    const buf = buildFeaturesFile([{ rmsDbfs: -30, band70_300: 0.5, band300_800: 0.1, band800_3000: 0.05 }], {
      formatVersion: 2,
    });
    expect(() => parseFeaturesFile(buf)).toThrow(/formatVersion|version/i);
  });

  it('throws when featureDims !== 4', () => {
    const buf = buildFeaturesFile([{ rmsDbfs: -30, band70_300: 0.5, band300_800: 0.1, band800_3000: 0.05 }], {
      featureDims: 3,
    });
    expect(() => parseFeaturesFile(buf)).toThrow(/featureDims/i);
  });

  it('throws when the buffer is shorter than header + frameCount*16', () => {
    const buf = buildFeaturesFile(
      [
        { rmsDbfs: -30, band70_300: 0.5, band300_800: 0.1, band800_3000: 0.05 },
        { rmsDbfs: -30, band70_300: 0.5, band300_800: 0.1, band800_3000: 0.05 },
      ],
      // Header claims 5 frames (28 + 5*16 = 108 bytes) but the buffer is
      // then truncated to only fit the 2 frames actually written (60 bytes).
      { frameCount: 5, truncateToBytes: 28 + 2 * 16 }
    );
    expect(() => parseFeaturesFile(buf)).toThrow(/truncated|short|length/i);
  });
});

describe('parseFeaturesFile — empty frames', () => {
  it('parses a zero-frame file to an empty frames array', () => {
    const buf = buildFeaturesFile([], { sampleRate: 16000, hopSamples: 1024 });
    const result = parseFeaturesFile(buf);
    expect(result.frames).toEqual([]);
    expect(result.hopMs).toBe(64);
  });
});
