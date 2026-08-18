/**
 * Parser for features.bin — the binary frame-feature file written by the
 * native Kotlin recorder after an overnight recording. This is a FROZEN
 * cross-layer contract: parse the layout exactly as documented below, do not
 * "improve" it here without a matching change on the native side.
 *
 * Layout (little-endian):
 *   offset  type  field
 *   0       u32   magic = 0x534E4631 ("SNF1")
 *   4       u16   formatVersion = 1
 *   6       u16   featureDims = 4
 *   8       u32   sampleRate (16000)
 *   12      u32   hopSamples (1024)
 *   16      u32   frameCount
 *   20      f64   startedAtEpochMs
 *   28      f32[frameCount][4]  per frame: rmsDbfs, band70_300, band300_800, band800_3000
 *
 * `band300_800` occupies a slot in every frame but is intentionally not
 * surfaced on `FeatureFrame` — it is reserved for a future discriminator and
 * is read-and-discarded here, not omitted from the file.
 */

import type { FeatureFrame } from '@/domain/snore/types';

const MAGIC = 0x534e4631; // "SNF1"
const SUPPORTED_FORMAT_VERSION = 1;
const FEATURE_DIMS = 4;
const HEADER_BYTES = 28;
const FRAME_BYTES = 16; // 4 x f32

export interface ParsedFeaturesFile {
  hopMs: number;
  sampleRate: number;
  startedAtEpochMs: number;
  frames: FeatureFrame[];
}

export function parseFeaturesFile(buf: ArrayBuffer): ParsedFeaturesFile {
  if (buf.byteLength < HEADER_BYTES) {
    throw new Error(
      `features.bin: buffer too short for header — expected at least ${HEADER_BYTES} bytes, got ${buf.byteLength}`
    );
  }

  const view = new DataView(buf);

  const magic = view.getUint32(0, true);
  if (magic !== MAGIC) {
    throw new Error(
      `features.bin: bad magic — expected 0x${MAGIC.toString(16)}, got 0x${magic.toString(16)}`
    );
  }

  const formatVersion = view.getUint16(4, true);
  if (formatVersion !== SUPPORTED_FORMAT_VERSION) {
    throw new Error(
      `features.bin: unsupported formatVersion — expected ${SUPPORTED_FORMAT_VERSION}, got ${formatVersion}`
    );
  }

  const featureDims = view.getUint16(6, true);
  if (featureDims !== FEATURE_DIMS) {
    throw new Error(
      `features.bin: unexpected featureDims — expected ${FEATURE_DIMS}, got ${featureDims}`
    );
  }

  const sampleRate = view.getUint32(8, true);
  const hopSamples = view.getUint32(12, true);
  const frameCount = view.getUint32(16, true);
  const startedAtEpochMs = view.getFloat64(20, true);

  const expectedBytes = HEADER_BYTES + frameCount * FRAME_BYTES;
  if (buf.byteLength < expectedBytes) {
    throw new Error(
      `features.bin: truncated — expected ${expectedBytes} bytes for ${frameCount} frames, got ${buf.byteLength}`
    );
  }

  const hopMs = (hopSamples / sampleRate) * 1000;

  const frames: FeatureFrame[] = new Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const offset = HEADER_BYTES + i * FRAME_BYTES;
    const rmsDbfs = view.getFloat32(offset, true);
    const lowBandRatio = view.getFloat32(offset + 4, true);
    // offset + 8: band300_800 — reserved, intentionally not read into FeatureFrame.
    const midBandRatio = view.getFloat32(offset + 12, true);
    frames[i] = { tMs: Math.round(i * hopMs), rmsDbfs, lowBandRatio, midBandRatio };
  }

  return { hopMs, sampleRate, startedAtEpochMs, frames };
}
