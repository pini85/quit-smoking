package app.unsmoke.snore

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Unit tests for [FeaturesFileWriter] — including a byte-for-byte golden
 * test transcribed from `tests/domain/fixtures/features-golden.bin.ts` (the
 * TS side's source-of-truth fixture for the frozen `features.bin` binary
 * contract; see that file's header doc for the exact frame values chosen to
 * be exact in IEEE-754 float32). If this test and the TS fixture ever
 * disagree, the TS fixture is the contract — this writer is what's wrong.
 */
class FeaturesFileWriterTest {

    /**
     * Transcribed byte-for-byte from `FEATURES_GOLDEN_BYTES` in
     * `tests/domain/fixtures/features-golden.bin.ts`: 3 frames, sampleRate
     * 16000, hopSamples 1024, startedAtEpochMs 1_700_000_000_000.
     */
    private val goldenBytes: ByteArray = intArrayOf(
        // --- header (28 bytes) ---
        0x31, 0x46, 0x4e, 0x53, // magic = 0x534E4631, u32 LE
        0x01, 0x00, // formatVersion = 1, u16 LE
        0x04, 0x00, // featureDims = 4, u16 LE
        0x80, 0x3e, 0x00, 0x00, // sampleRate = 16000, u32 LE
        0x00, 0x04, 0x00, 0x00, // hopSamples = 1024, u32 LE
        0x03, 0x00, 0x00, 0x00, // frameCount = 3, u32 LE
        0x00, 0x00, 0x80, 0x56, 0xfe, 0xbc, 0x78, 0x42, // startedAtEpochMs = 1_700_000_000_000, f64 LE

        // --- frame 0: rmsDbfs=-40.0, band70_300=0.5, band300_800=0.9375, band800_3000=0.125 ---
        0x00, 0x00, 0x20, 0xc2,
        0x00, 0x00, 0x00, 0x3f,
        0x00, 0x00, 0x70, 0x3f,
        0x00, 0x00, 0x00, 0x3e,

        // --- frame 1: rmsDbfs=-20.5, band70_300=0.25, band300_800=0.8125, band800_3000=0.0625 ---
        0x00, 0x00, 0xa4, 0xc1,
        0x00, 0x00, 0x80, 0x3e,
        0x00, 0x00, 0x50, 0x3f,
        0x00, 0x00, 0x80, 0x3d,

        // --- frame 2: rmsDbfs=-35.25, band70_300=0.125, band300_800=0.5625, band800_3000=0.03125 ---
        0x00, 0x00, 0x0d, 0xc2,
        0x00, 0x00, 0x00, 0x3e,
        0x00, 0x00, 0x10, 0x3f,
        0x00, 0x00, 0x00, 0x3d,
    ).map { it.toByte() }.toByteArray()

    private fun tempFile(): File = File.createTempFile("features-test", ".bin").apply { deleteOnExit() }

    @Test
    fun `golden bytes match the TS fixture exactly`() {
        val file = tempFile()
        val writer = FeaturesFileWriter(file, sampleRate = 16000, hopSamples = 1024, startedAtEpochMs = 1_700_000_000_000L)
        writer.writeFrame(floatArrayOf(-40.0f, 0.5f, 0.9375f, 0.125f))
        writer.writeFrame(floatArrayOf(-20.5f, 0.25f, 0.8125f, 0.0625f))
        writer.writeFrame(floatArrayOf(-35.25f, 0.125f, 0.5625f, 0.03125f))
        writer.finish(3)

        assertArrayEquals(goldenBytes, file.readBytes())
    }

    @Test
    fun `finish patches frameCount at offset 16 after frames are written`() {
        val file = tempFile()
        val writer = FeaturesFileWriter(file, sampleRate = 16000, hopSamples = 1024, startedAtEpochMs = 0L)
        repeat(5) { writer.writeFrame(floatArrayOf(0f, 0f, 0f, 0f)) }
        writer.finish(5)

        val bytes = file.readBytes()
        assertEquals(28 + 5 * 16, bytes.size)
        val frameCount = ByteBuffer.wrap(bytes, 16, 4).order(ByteOrder.LITTLE_ENDIAN).int
        assertEquals(5, frameCount)
    }

    @Test
    fun `finish writes the caller-provided frameCount, not the number of writeFrame calls`() {
        // frameCount is the authoritative value FeatureExtractor passes in
        // (e.g. after a truncated final segment stopped extraction early) --
        // it need not equal how many writeFrame() calls actually happened.
        val file = tempFile()
        val writer = FeaturesFileWriter(file, sampleRate = 16000, hopSamples = 1024, startedAtEpochMs = 0L)
        writer.writeFrame(floatArrayOf(1f, 2f, 3f, 4f))
        writer.writeFrame(floatArrayOf(5f, 6f, 7f, 8f))
        writer.finish(2)

        val frameCount = ByteBuffer.wrap(file.readBytes(), 16, 4).order(ByteOrder.LITTLE_ENDIAN).int
        assertEquals(2, frameCount)
    }

    @Test
    fun `every header field is little-endian`() {
        val file = tempFile()
        val writer = FeaturesFileWriter(file, sampleRate = 44100, hopSamples = 512, startedAtEpochMs = 123_456_789_012L)
        writer.finish(0)

        val buf = ByteBuffer.wrap(file.readBytes()).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals(0x534E4631, buf.getInt(0))
        assertEquals(1, buf.getShort(4).toInt())
        assertEquals(4, buf.getShort(6).toInt())
        assertEquals(44100, buf.getInt(8))
        assertEquals(512, buf.getInt(12))
        assertEquals(0, buf.getInt(16))
        assertEquals(123_456_789_012.0, buf.getDouble(20), 0.0)
    }

    @Test
    fun `every frame field is little-endian`() {
        val file = tempFile()
        val writer = FeaturesFileWriter(file, sampleRate = 16000, hopSamples = 1024, startedAtEpochMs = 0L)
        writer.writeFrame(floatArrayOf(-40.0f, 0.5f, 0.9375f, 0.125f))
        writer.finish(1)

        val buf = ByteBuffer.wrap(file.readBytes()).order(ByteOrder.LITTLE_ENDIAN)
        assertEquals(-40.0f, buf.getFloat(28), 0.0f)
        assertEquals(0.5f, buf.getFloat(32), 0.0f)
        assertEquals(0.9375f, buf.getFloat(36), 0.0f)
        assertEquals(0.125f, buf.getFloat(40), 0.0f)
    }
}
