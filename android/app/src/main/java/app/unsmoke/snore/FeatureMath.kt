package app.unsmoke.snore

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.log10
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Pure DSP math for the per-frame audio features written into `features.bin`
 * (see `FeaturesFileWriter`/`FeatureExtractor` and, for the frozen binary
 * layout, `domain/snore/featuresFile.ts`). Deliberately free of any
 * `android.*` import so it is fully unit-testable on the plain JVM (no
 * Robolectric) — see `FeatureMathTest.kt`.
 */
object FeatureMath {

    /** Frame size in samples: one hop of 16kHz audio = 1024 samples = 64ms. Must be a power of two for [fft]. */
    const val FRAME_SIZE = 1024

    private const val SILENCE_DBFS = -96f
    private const val FULL_SCALE = 32768.0

    private const val BAND_70_300_LO = 70.0
    private const val BAND_70_300_HI = 300.0
    private const val BAND_300_800_LO = 300.0
    private const val BAND_300_800_HI = 800.0
    private const val BAND_800_3000_LO = 800.0
    private const val BAND_800_3000_HI = 3000.0

    /** Precomputed periodic Hann window (`0.5 - 0.5*cos(2*pi*n/(N-1))`) for [FRAME_SIZE] samples. */
    private val HANN_WINDOW: DoubleArray = DoubleArray(FRAME_SIZE) { n ->
        0.5 - 0.5 * cos(2.0 * PI * n / (FRAME_SIZE - 1))
    }

    /**
     * RMS level of [n] samples of [samples], in dBFS (`20*log10(rms/32768)`),
     * clamped at [SILENCE_DBFS]. True silence (rms == 0, e.g. an all-zero
     * buffer) also maps to [SILENCE_DBFS] rather than `-Infinity`.
     */
    fun rmsDbfs(samples: ShortArray, n: Int): Float {
        if (n <= 0) return SILENCE_DBFS
        var sumSquares = 0.0
        for (i in 0 until n) {
            val v = samples[i].toDouble()
            sumSquares += v * v
        }
        val rms = sqrt(sumSquares / n) / FULL_SCALE
        if (rms <= 0.0) return SILENCE_DBFS
        val db = 20.0 * log10(rms)
        return if (db < SILENCE_DBFS) SILENCE_DBFS else db.toFloat()
    }

    /**
     * Fraction of total spectral energy (sum of squared magnitudes) falling
     * into each of the three bands, out of the total across ALL bins above
     * DC (bin 0 is always excluded from both the per-band sums and the
     * total). [magnitudesSquared] holds bins `0..N/2` inclusive (the
     * non-redundant half of a real-input FFT's spectrum, DC through
     * Nyquist) — its FFT size `N` is derived as `(magnitudesSquared.size - 1) * 2`.
     * Bin `k` is treated as covering the frequency `k * sampleRate / N`; a
     * bin is assigned to a band when that center frequency lies in
     * `[lo, hi)`. Each fraction is in `0..1`; if the total energy above DC is
     * zero (e.g. true silence), all three fractions are `0f`.
     */
    fun bandEnergyFractions(magnitudesSquared: DoubleArray, sampleRate: Int): Triple<Float, Float, Float> {
        val fftSize = (magnitudesSquared.size - 1) * 2
        var total = 0.0
        var e70_300 = 0.0
        var e300_800 = 0.0
        var e800_3000 = 0.0
        for (k in 1 until magnitudesSquared.size) {
            val energy = magnitudesSquared[k]
            val freq = k.toDouble() * sampleRate / fftSize
            total += energy
            if (freq >= BAND_70_300_LO && freq < BAND_70_300_HI) {
                e70_300 += energy
            } else if (freq >= BAND_300_800_LO && freq < BAND_300_800_HI) {
                e300_800 += energy
            } else if (freq >= BAND_800_3000_LO && freq < BAND_800_3000_HI) {
                e800_3000 += energy
            }
        }
        if (total <= 0.0) return Triple(0f, 0f, 0f)
        return Triple((e70_300 / total).toFloat(), (e300_800 / total).toFloat(), (e800_3000 / total).toFloat())
    }

    /**
     * Computes the 4-element feature vector for one [FRAME_SIZE]-sample
     * frame: `[rmsDbfs, band70_300, band300_800, band800_3000]` — exactly
     * the per-frame float layout `FeaturesFileWriter`/`features.bin` expect.
     * `rmsDbfs` is computed on the raw, UN-windowed [samples]; the spectral
     * bands are computed on a Hann-windowed copy.
     */
    fun computeFrame(samples: ShortArray): FloatArray {
        require(samples.size == FRAME_SIZE) {
            "computeFrame requires exactly $FRAME_SIZE samples, got ${samples.size}"
        }
        val rms = rmsDbfs(samples, samples.size)

        val real = DoubleArray(FRAME_SIZE)
        val imag = DoubleArray(FRAME_SIZE)
        for (i in 0 until FRAME_SIZE) {
            real[i] = samples[i].toDouble() * HANN_WINDOW[i]
        }
        fft(real, imag)

        // Non-redundant half of the spectrum for a real input: bins 0..N/2 inclusive (DC..Nyquist).
        val magnitudesSquared = DoubleArray(FRAME_SIZE / 2 + 1)
        for (k in magnitudesSquared.indices) {
            magnitudesSquared[k] = real[k] * real[k] + imag[k] * imag[k]
        }
        val (b70_300, b300_800, b800_3000) = bandEnergyFractions(magnitudesSquared, SAMPLE_RATE_HZ)

        return floatArrayOf(rms, b70_300, b300_800, b800_3000)
    }

    /** The fixed sample rate this recorder/extractor operates at (see `FeatureExtractor`). */
    const val SAMPLE_RATE_HZ = 16000

    /**
     * In-place iterative radix-2 Cooley-Tukey decimation-in-time FFT.
     * `real`/`imag` must be the same power-of-two length (here always
     * [FRAME_SIZE]); on return they hold the transform, overwriting the
     * input.
     */
    fun fft(real: DoubleArray, imag: DoubleArray) {
        val n = real.size
        require(n and (n - 1) == 0) { "fft size must be a power of two, got $n" }

        // Bit-reversal permutation.
        var j = 0
        for (i in 1 until n) {
            var bit = n shr 1
            while (bit != 0 && (j and bit) != 0) {
                j = j xor bit
                bit = bit shr 1
            }
            j = j or bit
            if (i < j) {
                val tr = real[i]; real[i] = real[j]; real[j] = tr
                val ti = imag[i]; imag[i] = imag[j]; imag[j] = ti
            }
        }

        // Iterative Cooley-Tukey butterflies, doubling the sub-transform length each pass.
        var len = 2
        while (len <= n) {
            val angle = -2.0 * PI / len
            val wLenR = cos(angle)
            val wLenI = sin(angle)
            var i = 0
            while (i < n) {
                var wr = 1.0
                var wi = 0.0
                val half = len / 2
                for (k in 0 until half) {
                    val evenIdx = i + k
                    val oddIdx = i + k + half
                    val oddR = real[oddIdx] * wr - imag[oddIdx] * wi
                    val oddI = real[oddIdx] * wi + imag[oddIdx] * wr
                    val evenR = real[evenIdx]
                    val evenI = imag[evenIdx]
                    real[evenIdx] = evenR + oddR
                    imag[evenIdx] = evenI + oddI
                    real[oddIdx] = evenR - oddR
                    imag[oddIdx] = evenI - oddI
                    val nextWr = wr * wLenR - wi * wLenI
                    val nextWi = wr * wLenI + wi * wLenR
                    wr = nextWr
                    wi = nextWi
                }
                i += len
            }
            len = len shl 1
        }
    }
}
