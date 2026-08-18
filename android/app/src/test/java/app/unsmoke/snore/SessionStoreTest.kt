package app.unsmoke.snore

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [SessionStateCodec] — the pure JSON (de)serialization +
 * state-transition + interrupted-detection logic pulled out of
 * [SessionStore] specifically so it can be tested here without Robolectric
 * (not set up in this project) and without any `android.content` dependency.
 */
class SessionStoreTest {

    // --- parse() on missing/invalid input -----------------------------------

    @Test
    fun `parse of null returns idle`() {
        val state = SessionStateCodec.parse(null)
        assertEquals(SessionState.PHASE_IDLE, state.phase)
        assertNull(state.sessionId)
        assertTrue(state.segments.isEmpty())
    }

    @Test
    fun `parse of blank string returns idle`() {
        assertEquals(SessionState.PHASE_IDLE, SessionStateCodec.parse("   ").phase)
    }

    @Test
    fun `parse of garbage json returns idle instead of throwing`() {
        val state = SessionStateCodec.parse("{not valid json")
        assertEquals(SessionState.PHASE_IDLE, state.phase)
    }

    // --- round-trip ----------------------------------------------------------

    @Test
    fun `round-trips an idle state`() {
        val state = SessionState.IDLE
        val restored = SessionStateCodec.parse(SessionStateCodec.serialize(state))
        assertEquals(state, restored)
    }

    @Test
    fun `round-trips a recording state with no segments yet`() {
        val state = SessionStateCodec.startRecording("session-1", 1_000L)
        val restored = SessionStateCodec.parse(SessionStateCodec.serialize(state))
        assertEquals(state, restored)
    }

    @Test
    fun `round-trips a recording state with segments`() {
        var state = SessionStateCodec.startRecording("session-1", 1_000L)
        state = SessionStateCodec.appendSegment(state, Segment("seg_0000.m4a", 20 * 60 * 1000L))
        state = SessionStateCodec.appendSegment(state, Segment("seg_0001.m4a", 5 * 60 * 1000L))

        val restored = SessionStateCodec.parse(SessionStateCodec.serialize(state))
        assertEquals(state, restored)
        assertEquals(2, restored.segments.size)
        assertEquals("seg_0000.m4a", restored.segments[0].file)
    }

    @Test
    fun `round-trips a stopped state with interrupted and stopReason`() {
        var state = SessionStateCodec.startRecording("session-1", 1_000L)
        state = SessionStateCodec.appendSegment(state, Segment("seg_0000.m4a", 3_000L))
        state = SessionStateCodec.stop(state, SessionState.STOP_REASON_LOW_STORAGE, interrupted = true, endedAt = 4_000L)

        val restored = SessionStateCodec.parse(SessionStateCodec.serialize(state))
        assertEquals(state, restored)
        assertEquals(SessionState.PHASE_STOPPED, restored.phase)
        assertEquals(SessionState.STOP_REASON_LOW_STORAGE, restored.stopReason)
        assertEquals(true, restored.interrupted)
        assertEquals(4_000L, restored.endedAt)
    }

    // --- individual transitions ------------------------------------------

    @Test
    fun `startRecording produces a fresh recording state with no segments`() {
        val state = SessionStateCodec.startRecording("session-42", 5_000L)
        assertEquals(SessionState.PHASE_RECORDING, state.phase)
        assertEquals("session-42", state.sessionId)
        assertEquals(5_000L, state.startedAt)
        assertTrue(state.segments.isEmpty())
        assertNull(state.endedAt)
        assertNull(state.stopReason)
        assertNull(state.interrupted)
    }

    @Test
    fun `appendSegment accumulates segments and preserves other fields`() {
        val started = SessionStateCodec.startRecording("session-1", 1_000L)
        val withOne = SessionStateCodec.appendSegment(started, Segment("seg_0000.m4a", 1_200_000L))
        val withTwo = SessionStateCodec.appendSegment(withOne, Segment("seg_0001.m4a", 300_000L))

        assertEquals(listOf(Segment("seg_0000.m4a", 1_200_000L), Segment("seg_0001.m4a", 300_000L)), withTwo.segments)
        assertEquals("session-1", withTwo.sessionId)
        assertEquals(1_000L, withTwo.startedAt)
        assertEquals(1_500_000L, withTwo.totalDurationMs())
    }

    @Test
    fun `stop transitions to stopped with the given reason and interrupted flag`() {
        val started = SessionStateCodec.startRecording("session-1", 1_000L)
        val withSegment = SessionStateCodec.appendSegment(started, Segment("seg_0000.m4a", 2_000L))
        val stopped = SessionStateCodec.stop(withSegment, SessionState.STOP_REASON_USER, interrupted = false, endedAt = 3_000L)

        assertEquals(SessionState.PHASE_STOPPED, stopped.phase)
        assertEquals(SessionState.STOP_REASON_USER, stopped.stopReason)
        assertFalse(stopped.interrupted!!)
        assertEquals(3_000L, stopped.endedAt)
        // Segments (and thus the derivable durationMs) survive the transition.
        assertEquals(1, stopped.segments.size)
        assertEquals("session-1", stopped.sessionId)
    }

    // --- checkLiveness (interrupted-detection) --------------------------

    @Test
    fun `checkLiveness is a no-op when recording and the service is running`() {
        val state = SessionStateCodec.startRecording("session-1", 1_000L)
        val checked = SessionStateCodec.checkLiveness(state, isRunning = true)
        assertEquals(state, checked)
    }

    @Test
    fun `checkLiveness is a no-op for idle regardless of isRunning`() {
        assertEquals(SessionState.IDLE, SessionStateCodec.checkLiveness(SessionState.IDLE, isRunning = false))
        assertEquals(SessionState.IDLE, SessionStateCodec.checkLiveness(SessionState.IDLE, isRunning = true))
    }

    @Test
    fun `checkLiveness is a no-op for an already-stopped state regardless of isRunning (idempotent stop)`() {
        var stopped = SessionStateCodec.startRecording("session-1", 1_000L)
        stopped = SessionStateCodec.appendSegment(stopped, Segment("seg_0000.m4a", 2_000L))
        stopped = SessionStateCodec.stop(stopped, SessionState.STOP_REASON_USER, interrupted = false, endedAt = 3_000L)

        val checkedRunning = SessionStateCodec.checkLiveness(stopped, isRunning = true)
        val checkedNotRunning = SessionStateCodec.checkLiveness(stopped, isRunning = false)

        assertEquals(stopped, checkedRunning)
        assertEquals(stopped, checkedNotRunning)
        // Repeated checks against the same persisted 'stopped' state keep
        // returning the identical result — nothing is consumed/cleared.
        assertEquals(checkedRunning, checkedNotRunning)
    }

    @Test
    fun `checkLiveness marks a dead process as stopped-interrupted-error with summed segment durations`() {
        var state = SessionStateCodec.startRecording("session-1", 10_000L)
        state = SessionStateCodec.appendSegment(state, Segment("seg_0000.m4a", 1_200_000L))
        state = SessionStateCodec.appendSegment(state, Segment("seg_0001.m4a", 300_000L))

        val recovered = SessionStateCodec.checkLiveness(state, isRunning = false)

        assertEquals(SessionState.PHASE_STOPPED, recovered.phase)
        assertEquals(SessionState.STOP_REASON_ERROR, recovered.stopReason)
        assertTrue(recovered.interrupted!!)
        // endedAt = startedAt + sum(finalized segment durations), NOT wall-clock "now".
        assertEquals(10_000L + 1_200_000L + 300_000L, recovered.endedAt)
        assertEquals("session-1", recovered.sessionId)
        assertEquals(2, recovered.segments.size)
    }

    @Test
    fun `checkLiveness marks a dead process with zero segments as stopped at startedAt`() {
        val state = SessionStateCodec.startRecording("session-1", 42_000L)
        val recovered = SessionStateCodec.checkLiveness(state, isRunning = false)

        assertEquals(SessionState.PHASE_STOPPED, recovered.phase)
        assertEquals(42_000L, recovered.endedAt)
        assertTrue(recovered.interrupted!!)
        assertEquals(SessionState.STOP_REASON_ERROR, recovered.stopReason)
    }
}
