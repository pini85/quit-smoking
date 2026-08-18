package app.unsmoke.snore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for [ClipMapper.mapRange] — the pure session-relative-ms to
 * segment-relative-offset mapping used by `cutClips`, deliberately free of
 * any `android.media.*` dependency (see [ClipCutter], which is the untested
 * Android-media-API-using consumer of this pure mapping).
 */
class ClipMapperTest {

    // Three segments of 5000ms, 3000ms, 4000ms -- cumulative boundaries at
    // 0-5000, 5000-8000, 8000-12000 (session total 12000ms).
    private val segments = listOf(
        SegmentSpan("seg_0000.m4a", 5_000L),
        SegmentSpan("seg_0001.m4a", 3_000L),
        SegmentSpan("seg_0002.m4a", 4_000L),
    )

    @Test
    fun `range within first segment maps directly, no cumulative offset`() {
        val slice = ClipMapper.mapRange(segments, 1_000L, 2_000L)
        assertEquals(ClipSlice(segmentIndex = 0, offsetInSegmentMs = 1_000L, durationMs = 1_000L), slice)
    }

    @Test
    fun `range in a later segment subtracts the cumulative duration of earlier segments`() {
        // Session-relative 9000..9500 falls inside segment 2 (starts at 8000),
        // so offset-in-segment is 9000 - 8000 = 1000.
        val slice = ClipMapper.mapRange(segments, 9_000L, 9_500L)
        assertEquals(ClipSlice(segmentIndex = 2, offsetInSegmentMs = 1_000L, durationMs = 500L), slice)
    }

    @Test
    fun `range spanning a segment boundary is clamped to the first segment's remainder`() {
        // Starts at 4000 (inside segment 0, which ends at 5000) and asks for
        // endMs=7000, which is inside segment 1 -- clamped back to segment
        // 0's own end (5000), not carried into segment 1.
        val slice = ClipMapper.mapRange(segments, 4_000L, 7_000L)
        assertEquals(ClipSlice(segmentIndex = 0, offsetInSegmentMs = 4_000L, durationMs = 1_000L), slice)
    }

    @Test
    fun `start at or past the total duration is out of bounds`() {
        assertNull(ClipMapper.mapRange(segments, 12_000L, 12_500L))
        assertNull(ClipMapper.mapRange(segments, 50_000L, 51_000L))
    }

    @Test
    fun `negative start is clamped to zero`() {
        val slice = ClipMapper.mapRange(segments, -500L, 1_000L)
        assertEquals(ClipSlice(segmentIndex = 0, offsetInSegmentMs = 0L, durationMs = 1_000L), slice)
    }

    @Test
    fun `end beyond the containing segment's own end is clamped to that segment's end`() {
        // Segment 1 spans session-relative 5000..8000; asking for endMs=100000
        // clamps to 8000, i.e. a duration of 8000-6000=2000.
        val slice = ClipMapper.mapRange(segments, 6_000L, 100_000L)
        assertEquals(ClipSlice(segmentIndex = 1, offsetInSegmentMs = 1_000L, durationMs = 2_000L), slice)
    }

    @Test
    fun `zero-length range after clamping maps to null`() {
        // startMs == endMs before any clamping.
        assertNull(ClipMapper.mapRange(segments, 3_000L, 3_000L))
        // startMs already at the containing segment's own end -- clamping
        // end down to the segment's end collapses the range to zero-length.
        assertNull(ClipMapper.mapRange(segments, 5_000L, 5_000L))
    }

    @Test
    fun `empty segment list is always out of bounds`() {
        assertNull(ClipMapper.mapRange(emptyList(), 0L, 1_000L))
    }
}
