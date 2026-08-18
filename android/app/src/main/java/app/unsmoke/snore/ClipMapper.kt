package app.unsmoke.snore

/**
 * One finalized segment's identity plus decodable duration, as needed by
 * [ClipMapper.mapRange] — deliberately its own tiny type (rather than reusing
 * [Segment]) so this file stays free of any transitive dependency on
 * `SessionState`'s (de)serialization concerns; it only needs a file name and
 * a duration.
 */
data class SegmentSpan(val file: String, val durationMs: Long)

/**
 * The result of mapping a session-relative `[startMs, endMs)` range onto one
 * physical segment file: `segmentIndex` into the list passed to
 * [ClipMapper.mapRange], `offsetInSegmentMs` from that segment's own start,
 * and the (possibly clamped) `durationMs` to cut from there. [ClipCutter]
 * resolves `segmentIndex` back to an actual file via
 * [RecordingService.segmentFileName] — the same naming convention
 * [RecordingService] itself writes segment files under.
 */
data class ClipSlice(val segmentIndex: Int, val offsetInSegmentMs: Long, val durationMs: Long)

/**
 * Pure (no `android.media.*` dependency) mapping from a session-relative
 * clip range to the single physical segment file it should be cut from.
 *
 * Segments are gapless and played back in list order, so a session-relative
 * timestamp maps onto a segment via the cumulative sum of every earlier
 * segment's `durationMs`. A requested range that spans a segment boundary
 * (`endMs` reaching into the NEXT segment) is deliberately CLAMPED to the
 * remainder of the segment containing `startMs`, rather than stitched across
 * both segments: cross-boundary clips are a rare edge case given the
 * recorder's 20-minute rotation (see `RecordingService`), and clamping keeps
 * [ClipCutter]'s muxer trivial — one input segment, one output file, no track
 * continuity to reconcile across two independently-encoded AAC streams.
 */
object ClipMapper {

    /**
     * Maps session-relative `[startMs, endMs)` onto the segment containing
     * `startMs`.
     *
     * - `startMs` is clamped up to 0 if negative.
     * - If the (clamped) `startMs` is at or past the session's total
     *   duration, there is no containing segment at all — returns `null`.
     * - `endMs` is clamped down to the containing segment's own end
     *   (cumulative-duration boundary), per the class doc above.
     * - If clamping collapses the range to zero (or negative) length,
     *   returns `null` — there is nothing to cut.
     */
    fun mapRange(segments: List<SegmentSpan>, startMs: Long, endMs: Long): ClipSlice? {
        val clampedStart = maxOf(0L, startMs)

        var cumulativeStart = 0L
        for ((index, segment) in segments.withIndex()) {
            val segmentEnd = cumulativeStart + segment.durationMs
            if (clampedStart < segmentEnd) {
                val offsetInSegmentMs = clampedStart - cumulativeStart
                val clampedEnd = minOf(endMs, segmentEnd)
                val durationMs = clampedEnd - clampedStart
                return if (durationMs > 0) {
                    ClipSlice(segmentIndex = index, offsetInSegmentMs = offsetInSegmentMs, durationMs = durationMs)
                } else {
                    null
                }
            }
            cumulativeStart = segmentEnd
        }
        // clampedStart >= total duration of every segment: out of bounds.
        return null
    }
}
