package app.unsmoke.snore

import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Streaming writer for `features.bin` — the binary frame-feature file this
 * recorder produces (see [FeatureExtractor]). The layout is a FROZEN
 * cross-layer contract; this MUST stay byte-identical to what
 * `domain/snore/featuresFile.ts` (the TS parser, source of truth) expects —
 * see `FeaturesFileWriterTest.kt`'s golden-bytes test, transcribed from
 * `tests/domain/fixtures/features-golden.bin.ts`.
 *
 * Layout (little-endian):
 * ```
 *   offset  type  field
 *   0       u32   magic = 0x534E4631 ("SNF1")
 *   4       u16   formatVersion = 1
 *   6       u16   featureDims = 4
 *   8       u32   sampleRate
 *   12      u32   hopSamples
 *   16      u32   frameCount
 *   20      f64   startedAtEpochMs
 *   28      f32[frameCount][4]  per frame: rmsDbfs, band70_300, band300_800, band800_3000
 * ```
 *
 * `frameCount` (offset 16) isn't known until every frame has been streamed,
 * so it can't just be written once up front. This deliberately uses a
 * [RandomAccessFile] against a real local file (rather than buffering the
 * whole header in memory, or writing to a temp file and copying at the
 * end): the header is written once with a `0` placeholder at construction
 * time, frames are appended sequentially after it, and [finish] seeks back
 * to offset 16 and patches in the real count before closing — a plain,
 * cheap random-access rewrite of 4 already-allocated bytes, no full-file
 * copy needed.
 *
 * Free of any `android.*` import so it's fully unit-testable on the plain
 * JVM (no Robolectric).
 */
class FeaturesFileWriter(
    file: File,
    sampleRate: Int,
    hopSamples: Int,
    startedAtEpochMs: Long,
) {
    private val raf = RandomAccessFile(file, "rw")

    init {
        raf.setLength(0)
        val header = ByteBuffer.allocate(HEADER_BYTES).order(ByteOrder.LITTLE_ENDIAN)
        header.putInt(MAGIC)
        header.putShort(FORMAT_VERSION)
        header.putShort(FEATURE_DIMS)
        header.putInt(sampleRate)
        header.putInt(hopSamples)
        header.putInt(0) // frameCount placeholder, patched in finish()
        header.putDouble(startedAtEpochMs.toDouble())
        raf.write(header.array())
    }

    /** Appends one frame — exactly [FEATURE_DIMS] floats: rmsDbfs, band70_300, band300_800, band800_3000. */
    fun writeFrame(frame: FloatArray) {
        require(frame.size == FEATURE_DIMS.toInt()) { "writeFrame requires exactly $FEATURE_DIMS floats, got ${frame.size}" }
        val buf = ByteBuffer.allocate(FRAME_BYTES).order(ByteOrder.LITTLE_ENDIAN)
        for (value in frame) buf.putFloat(value)
        raf.write(buf.array())
    }

    /**
     * Patches the header's `frameCount` field (offset 16) with [frameCount]
     * — the authoritative count of frames actually written — and closes the
     * file. Must be called exactly once, after every [writeFrame] call.
     */
    fun finish(frameCount: Int) {
        raf.seek(FRAME_COUNT_OFFSET.toLong())
        val buf = ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN)
        buf.putInt(frameCount)
        raf.write(buf.array())
        raf.close()
    }

    companion object {
        const val MAGIC = 0x534E4631 // "SNF1"
        const val FORMAT_VERSION: Short = 1
        const val FEATURE_DIMS: Short = 4
        const val HEADER_BYTES = 28
        const val FRAME_BYTES = 16 // 4 x f32
        const val FRAME_COUNT_OFFSET = 16
    }
}
