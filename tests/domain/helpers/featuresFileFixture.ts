/**
 * Test-only encoder for the features.bin binary layout — the mirror image of
 * `domain/snore/featuresFile.ts#parseFeaturesFile`. NOT shipped domain code:
 * production features files are written by the native Kotlin recorder, so
 * this exists purely so tests can construct valid (and deliberately invalid)
 * buffers without hand-writing bytes every time.
 *
 * Byte layout (little-endian), see the brief / `featuresFile.ts` doc comment:
 *   0   u32  magic = 0x534E4631 ("SNF1")
 *   4   u16  formatVersion
 *   6   u16  featureDims
 *   8   u32  sampleRate
 *   12  u32  hopSamples
 *   16  u32  frameCount
 *   20  f64  startedAtEpochMs
 *   28  f32[frameCount][4]  per frame: rmsDbfs, band70_300, band300_800, band800_3000
 */

export const FEATURES_FILE_MAGIC = 0x534e4631;
export const HEADER_BYTES = 28;
export const FRAME_FIELD_BYTES = 16; // 4 x f32

export interface FixtureFrame {
  rmsDbfs: number;
  band70_300: number;
  band300_800: number;
  band800_3000: number;
}

export interface FixtureMeta {
  magic?: number;
  formatVersion?: number;
  featureDims?: number;
  sampleRate?: number;
  hopSamples?: number;
  frameCount?: number; // overridable to fabricate a truncated/mismatched file
  startedAtEpochMs?: number;
  /** Truncates the final buffer to this byte length AFTER writing, to build "too short" fixtures. */
  truncateToBytes?: number;
}

const DEFAULT_META: Required<Omit<FixtureMeta, 'frameCount' | 'truncateToBytes'>> = {
  magic: FEATURES_FILE_MAGIC,
  formatVersion: 1,
  featureDims: 4,
  sampleRate: 16000,
  hopSamples: 1024,
  startedAtEpochMs: 1_700_000_000_000,
};

/** Builds a features.bin-shaped ArrayBuffer from frame values and (overridable) header metadata. */
export function buildFeaturesFile(frames: FixtureFrame[], meta: FixtureMeta = {}): ArrayBuffer {
  const merged = { ...DEFAULT_META, ...meta };
  const frameCount = meta.frameCount ?? frames.length;
  const totalBytes = HEADER_BYTES + frameCount * FRAME_FIELD_BYTES;
  const buf = new ArrayBuffer(totalBytes);
  const view = new DataView(buf);

  view.setUint32(0, merged.magic, true);
  view.setUint16(4, merged.formatVersion, true);
  view.setUint16(6, merged.featureDims, true);
  view.setUint32(8, merged.sampleRate, true);
  view.setUint32(12, merged.hopSamples, true);
  view.setUint32(16, frameCount, true);
  view.setFloat64(20, merged.startedAtEpochMs, true);

  frames.forEach((frame, i) => {
    const offset = HEADER_BYTES + i * FRAME_FIELD_BYTES;
    if (offset + FRAME_FIELD_BYTES > totalBytes) return; // frameCount overridden smaller than frames.length
    view.setFloat32(offset, frame.rmsDbfs, true);
    view.setFloat32(offset + 4, frame.band70_300, true);
    view.setFloat32(offset + 8, frame.band300_800, true);
    view.setFloat32(offset + 12, frame.band800_3000, true);
  });

  if (meta.truncateToBytes !== undefined) {
    return buf.slice(0, meta.truncateToBytes);
  }
  return buf;
}
