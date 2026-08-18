/**
 * Golden features.bin fixture — hand-assembled bytes (NOT produced by the
 * TS encoder helper) for 3 frames with simple, exact-in-float32 values.
 *
 * This exact byte sequence is expected to be pinned by a future Kotlin JUnit
 * test on the native side, so treat `FEATURES_GOLDEN_BYTES` as a frozen
 * cross-layer fixture: do not "clean it up" without checking with the native
 * side first.
 *
 * Header (little-endian):
 *   magic            = 0x534E4631 ("SNF1")
 *   formatVersion    = 1
 *   featureDims      = 4
 *   sampleRate       = 16000
 *   hopSamples       = 1024               (=> hopMs = 1024/16000*1000 = 64)
 *   frameCount       = 3
 *   startedAtEpochMs = 1_700_000_000_000
 *
 * Frames (rmsDbfs, band70_300, band300_800 [reserved, ignored by the
 * parser], band800_3000), chosen to be exact in IEEE-754 float32:
 *   frame 0: -40.0,   0.5,   0.9375, 0.125
 *   frame 1: -20.5,   0.25,  0.8125, 0.0625
 *   frame 2: -35.25,  0.125, 0.5625, 0.03125
 */
export const FEATURES_GOLDEN_BYTES = new Uint8Array([
  // --- header (28 bytes) ---
  // magic = 0x534E4631, little-endian u32
  0x31, 0x46, 0x4e, 0x53,
  // formatVersion = 1, u16
  0x01, 0x00,
  // featureDims = 4, u16
  0x04, 0x00,
  // sampleRate = 16000, u32
  0x80, 0x3e, 0x00, 0x00,
  // hopSamples = 1024, u32
  0x00, 0x04, 0x00, 0x00,
  // frameCount = 3, u32
  0x03, 0x00, 0x00, 0x00,
  // startedAtEpochMs = 1_700_000_000_000, f64
  0x00, 0x00, 0x80, 0x56, 0xfe, 0xbc, 0x78, 0x42,

  // --- frame 0: rmsDbfs=-40.0, band70_300=0.5, band300_800=0.9375, band800_3000=0.125 ---
  0x00, 0x00, 0x20, 0xc2, // rmsDbfs = -40.0 (f32)
  0x00, 0x00, 0x00, 0x3f, // band70_300 = 0.5 (f32)
  0x00, 0x00, 0x70, 0x3f, // band300_800 = 0.9375 (f32) — reserved, must be skipped
  0x00, 0x00, 0x00, 0x3e, // band800_3000 = 0.125 (f32)

  // --- frame 1: rmsDbfs=-20.5, band70_300=0.25, band300_800=0.8125, band800_3000=0.0625 ---
  0x00, 0x00, 0xa4, 0xc1, // rmsDbfs = -20.5 (f32)
  0x00, 0x00, 0x80, 0x3e, // band70_300 = 0.25 (f32)
  0x00, 0x00, 0x50, 0x3f, // band300_800 = 0.8125 (f32) — reserved, must be skipped
  0x00, 0x00, 0x80, 0x3d, // band800_3000 = 0.0625 (f32)

  // --- frame 2: rmsDbfs=-35.25, band70_300=0.125, band300_800=0.5625, band800_3000=0.03125 ---
  0x00, 0x00, 0x0d, 0xc2, // rmsDbfs = -35.25 (f32)
  0x00, 0x00, 0x00, 0x3e, // band70_300 = 0.125 (f32)
  0x00, 0x00, 0x10, 0x3f, // band300_800 = 0.5625 (f32) — reserved, must be skipped
  0x00, 0x00, 0x00, 0x3d, // band800_3000 = 0.03125 (f32)
]);

export const FEATURES_GOLDEN_META = {
  sampleRate: 16000,
  hopSamples: 1024,
  hopMs: 64,
  frameCount: 3,
  startedAtEpochMs: 1_700_000_000_000,
};

/** Expected `parseFeaturesFile(...).frames` for `FEATURES_GOLDEN_BYTES`. */
export const FEATURES_GOLDEN_FRAMES = [
  { tMs: 0, rmsDbfs: -40.0, lowBandRatio: 0.5, midBandRatio: 0.125 },
  { tMs: 64, rmsDbfs: -20.5, lowBandRatio: 0.25, midBandRatio: 0.0625 },
  { tMs: 128, rmsDbfs: -35.25, lowBandRatio: 0.125, midBandRatio: 0.03125 },
];
