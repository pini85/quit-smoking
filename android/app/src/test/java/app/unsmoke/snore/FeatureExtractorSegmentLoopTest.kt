package app.unsmoke.snore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * Unit tests for [runSegmentsWithRecovery] — the pure per-segment
 * iteration + error-recovery loop factored out of
 * [FeatureExtractor.extract] specifically so this counting behavior is
 * unit-testable without any `android.media.*` dependency. Uses fake
 * per-segment "producers" (plain lambdas standing in for a real
 * `extractSegment` decode call) instead of real MediaCodec/MediaExtractor
 * calls.
 *
 * The core regression these guard against: frame counting must happen
 * from INSIDE the per-frame write callback (as [FeatureExtractor.extract]
 * does), not from a per-segment return value — a segment that produces
 * some frames and then throws must not have those already-produced frames
 * discarded from the running count.
 */
class FeatureExtractorSegmentLoopTest {

    @Test
    fun `counts frames across every segment when nothing fails`() {
        var frameCount = 0
        val framesPerSegment = listOf(3, 2, 4)
        runSegmentsWithRecovery(
            segmentCount = framesPerSegment.size,
            decodeOne = { index -> repeat(framesPerSegment[index]) { frameCount++ } },
            onSegmentFailed = { _, _ -> fail("no segment should fail in this test") },
        )
        assertEquals(9, frameCount)
    }

    @Test
    fun `a mid-segment failure keeps frames already produced by that same segment`() {
        // Segment 1 (index 1) writes 5 frames, THEN throws on what would
        // have been its 6th -- those 5 must survive in frameCount, exactly
        // like frames already streamed to FeaturesFileWriter would.
        var frameCount = 0
        var failedIndex = -1
        runSegmentsWithRecovery(
            segmentCount = 3,
            decodeOne = { index ->
                when (index) {
                    0 -> repeat(10) { frameCount++ }
                    1 -> {
                        repeat(5) { frameCount++ }
                        throw RuntimeException("simulated corrupt segment")
                    }
                    2 -> repeat(10) { frameCount++ }
                }
            },
            onSegmentFailed = { index, _ -> failedIndex = index },
        )

        // Segment 0's 10 frames + segment 1's 5 frames-before-the-throw.
        assertEquals(15, frameCount)
        assertEquals(1, failedIndex)
    }

    @Test
    fun `stops iterating after a segment fails -- later segments are never attempted`() {
        var frameCount = 0
        var segment2Attempted = false
        runSegmentsWithRecovery(
            segmentCount = 3,
            decodeOne = { index ->
                when (index) {
                    0 -> repeat(4) { frameCount++ }
                    1 -> throw RuntimeException("simulated failure")
                    2 -> {
                        segment2Attempted = true
                        repeat(4) { frameCount++ }
                    }
                }
            },
            onSegmentFailed = { _, _ -> },
        )
        assertEquals(4, frameCount)
        assertFalse("segment 2 should never be attempted once segment 1 fails", segment2Attempted)
    }

    @Test
    fun `an UnsupportedSampleRateException is not caught -- it propagates`() {
        var frameCount = 0
        var onSegmentFailedCalled = false
        try {
            runSegmentsWithRecovery(
                segmentCount = 2,
                decodeOne = { index ->
                    repeat(3) { frameCount++ }
                    if (index == 0) throw UnsupportedSampleRateException("wrong rate")
                },
                onSegmentFailed = { _, _ -> onSegmentFailedCalled = true },
            )
            fail("expected UnsupportedSampleRateException to propagate")
        } catch (e: UnsupportedSampleRateException) {
            // expected
        }
        // The 3 frames produced before the fatal throw are still counted
        // (same "count from the callback, not the return value" property),
        // even though the exception itself propagates rather than being
        // reported via onSegmentFailed.
        assertEquals(3, frameCount)
        assertFalse(onSegmentFailedCalled)
    }

    @Test
    fun `zero segments is a no-op`() {
        var frameCount = 0
        runSegmentsWithRecovery(
            segmentCount = 0,
            decodeOne = { fail("decodeOne should never be called for zero segments") },
            onSegmentFailed = { _, _ -> fail("onSegmentFailed should never be called for zero segments") },
        )
        assertEquals(0, frameCount)
    }

    @Test
    fun `a segment producing zero frames before failing still reports the failure`() {
        var failedIndex = -1
        var frameCount = 0
        runSegmentsWithRecovery(
            segmentCount = 1,
            decodeOne = { throw RuntimeException("corrupt from the very first hop") },
            onSegmentFailed = { index, _ -> failedIndex = index },
        )
        assertEquals(0, frameCount)
        assertTrue(failedIndex == 0)
    }
}
