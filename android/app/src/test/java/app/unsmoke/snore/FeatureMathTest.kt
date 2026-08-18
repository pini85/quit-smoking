package app.unsmoke.snore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Unit tests for [FeatureMath] — the pure DSP math behind `features.bin`'s
 * per-frame vector — run against known sinusoids at 16kHz / 1024-sample
 * frames, so no Robolectric or `android.*` dependency is needed.
 */
class FeatureMathTest {

    private val sampleRate = FeatureMath.SAMPLE_RATE_HZ
    private val frameSize = FeatureMath.FRAME_SIZE

    /** A full-scale sine of [freqHz] sampled at 16kHz for one [frameSize]-sample frame. */
    private fun sineFrame(freqHz: Double, amplitude: Double = 32767.0): ShortArray =
        ShortArray(frameSize) { i ->
            (amplitude * sin(2.0 * PI * freqHz * i / sampleRate)).roundToInt().toShort()
        }

    private fun silenceFrame(): ShortArray = ShortArray(frameSize)

    // --- rmsDbfs -------------------------------------------------------------

    @Test
    fun `rmsDbfs of silence is -96 dBFS`() {
        assertEquals(-96f, FeatureMath.rmsDbfs(silenceFrame(), frameSize), 0.0001f)
    }

    @Test
    fun `rmsDbfs of a full-scale sine is near -3-01 dBFS`() {
        // RMS of a sine = amplitude / sqrt(2); at full scale (~32767/32768)
        // that's 20*log10(1/sqrt(2)) =~ -3.0103 dBFS.
        val db = FeatureMath.rmsDbfs(sineFrame(1000.0), frameSize)
        assertEquals(-3.01f, db, 0.05f)
    }

    @Test
    fun `rmsDbfs of n=0 is -96 dBFS`() {
        assertEquals(-96f, FeatureMath.rmsDbfs(ShortArray(frameSize), 0), 0.0001f)
    }

    // --- computeFrame band placement ------------------------------------------

    @Test
    fun `250 Hz sine (on-bin) lands almost entirely in band70_300`() {
        // bin = 250 * 1024 / 16000 = 16.0 exactly.
        val features = FeatureMath.computeFrame(sineFrame(250.0))
        val (_, b70_300, b300_800, b800_3000) = FrameFeatures(features)
        assertTrue("b70_300=$b70_300 should be >= 0.95", b70_300 >= 0.95f)
        assertTrue(b300_800 < b70_300)
        assertTrue(b800_3000 < b70_300)
    }

    @Test
    fun `500 Hz sine (on-bin) lands almost entirely in band300_800`() {
        // bin = 500 * 1024 / 16000 = 32.0 exactly.
        val features = FeatureMath.computeFrame(sineFrame(500.0))
        val (_, b70_300, b300_800, b800_3000) = FrameFeatures(features)
        assertTrue("b300_800=$b300_800 should be >= 0.95", b300_800 >= 0.95f)
        assertTrue(b70_300 < b300_800)
        assertTrue(b800_3000 < b300_800)
    }

    @Test
    fun `1 kHz sine (on-bin) lands almost entirely in band800_3000`() {
        // bin = 1000 * 1024 / 16000 = 64.0 exactly. 1kHz falls in the
        // 800-3000 Hz band, NOT band300_800 — asserted explicitly here since
        // it's easy to mis-place at a glance.
        val features = FeatureMath.computeFrame(sineFrame(1000.0))
        val (_, b70_300, b300_800, b800_3000) = FrameFeatures(features)
        assertTrue("b800_3000=$b800_3000 should be >= 0.95", b800_3000 >= 0.95f)
        assertTrue(b70_300 < b800_3000)
        assertTrue(b300_800 < b800_3000)
    }

    @Test
    fun `white silence produces -96 dBFS and zero band fractions`() {
        val features = FeatureMath.computeFrame(silenceFrame())
        assertEquals(-96f, features[0], 0.0001f)
        assertEquals(0f, features[1], 0.0001f)
        assertEquals(0f, features[2], 0.0001f)
        assertEquals(0f, features[3], 0.0001f)
    }

    @Test
    fun `off-bin sine still lands at least 0-9 in its band (Hann window bounds leakage)`() {
        // bin = 155 * 1024 / 16000 = 9.92 -- deliberately not an integer bin.
        val features = FeatureMath.computeFrame(sineFrame(155.0))
        val (_, b70_300, _, _) = FrameFeatures(features)
        assertTrue("b70_300=$b70_300 should be >= 0.9 despite off-bin leakage", b70_300 >= 0.9f)
    }

    @Test
    fun `rmsDbfs is computed on the raw un-windowed samples`() {
        // If rmsDbfs were (incorrectly) computed post-Hann-window, a
        // full-scale sine's level would come out lower than -3.01 dBFS
        // (Hann attenuates most samples toward the frame edges).
        val samples = sineFrame(1000.0)
        val direct = FeatureMath.rmsDbfs(samples, samples.size)
        val fromFrame = FeatureMath.computeFrame(samples)[0]
        assertEquals(direct, fromFrame, 0.0001f)
    }

    // --- bandEnergyFractions edge cases ----------------------------------------

    @Test
    fun `bandEnergyFractions of all-zero energy is zero for every band`() {
        val magnitudesSquared = DoubleArray(FeatureMath.FRAME_SIZE / 2 + 1)
        val (b1, b2, b3) = FeatureMath.bandEnergyFractions(magnitudesSquared, sampleRate)
        assertEquals(0f, b1, 0.0001f)
        assertEquals(0f, b2, 0.0001f)
        assertEquals(0f, b3, 0.0001f)
    }

    @Test
    fun `bandEnergyFractions excludes the DC bin from both numerator and denominator`() {
        // All the energy sits at DC (bin 0, sub-70Hz) -- since DC is
        // excluded from the total, every band's fraction must be zero, not
        // NaN or divide-by-zero.
        val magnitudesSquared = DoubleArray(FeatureMath.FRAME_SIZE / 2 + 1)
        magnitudesSquared[0] = 1_000_000.0
        val (b1, b2, b3) = FeatureMath.bandEnergyFractions(magnitudesSquared, sampleRate)
        assertEquals(0f, b1, 0.0001f)
        assertEquals(0f, b2, 0.0001f)
        assertEquals(0f, b3, 0.0001f)
    }

    // --- fft sanity ------------------------------------------------------------

    @Test
    fun `fft of a DC-only signal has all energy in bin 0`() {
        val real = DoubleArray(frameSize) { 1.0 }
        val imag = DoubleArray(frameSize)
        FeatureMath.fft(real, imag)
        assertEquals(frameSize.toDouble(), real[0], 0.0001)
        for (k in 1 until frameSize) {
            assertEquals(0.0, real[k], 1e-6)
            assertEquals(0.0, imag[k], 1e-6)
        }
    }

    /** Small helper to destructure a 4-element feature vector by name in tests. */
    private data class FrameFeatures(val rmsDbfs: Float, val b70_300: Float, val b300_800: Float, val b800_3000: Float) {
        constructor(features: FloatArray) : this(features[0], features[1], features[2], features[3])
    }
}
