package app.unsmoke.snore

import org.json.JSONArray
import org.json.JSONObject

/**
 * One finalized audio segment of a recording session (see
 * [RecordingService]'s 20-minute rotation). `file` is a name relative to the
 * session's directory (e.g. "seg_0000.m4a"), never an absolute path.
 */
data class Segment(val file: String, val durationMs: Long)

/**
 * The persisted session state machine. Mirrors the TS `RecordingStatus`
 * shape in `lib/native/snoreMonitor.ts` 1:1 (field names and the
 * phase/stopReason string values must match exactly — the JS/native bridge
 * is stringly-typed).
 *
 * `phase` transitions: idle -> recording -> stopped -> idle (via
 * deleteSessionAudio, a later task) or recording -> recording (a fresh
 * `startRecording` overwriting a stale, unclaimed 'stopped' session — see
 * [SessionStore]'s doc on that ruling).
 */
data class SessionState(
    val phase: String,
    val sessionId: String? = null,
    val startedAt: Long? = null,
    val endedAt: Long? = null,
    val stopReason: String? = null,
    val interrupted: Boolean? = null,
    val segments: List<Segment> = emptyList(),
) {
    companion object {
        const val PHASE_IDLE = "idle"
        const val PHASE_RECORDING = "recording"
        const val PHASE_STOPPED = "stopped"

        const val STOP_REASON_USER = "user"
        const val STOP_REASON_NOTIFICATION = "notification"
        const val STOP_REASON_ERROR = "error"
        const val STOP_REASON_LOW_STORAGE = "low-storage"

        val IDLE = SessionState(phase = PHASE_IDLE)
    }

    /** Sum of every finalized segment's decodable duration. */
    fun totalDurationMs(): Long = segments.sumOf { it.durationMs }
}

/**
 * Pure (de)serialization + state-transition + interrupted-detection logic
 * for [SessionState], deliberately free of any `android.content` dependency
 * so it can be unit-tested on the plain JVM without Robolectric (which this
 * project does not have set up). [SessionStore] is the thin, untested
 * SharedPreferences shell around this.
 */
object SessionStateCodec {

    private const val KEY_PHASE = "phase"
    private const val KEY_SESSION_ID = "sessionId"
    private const val KEY_STARTED_AT = "startedAt"
    private const val KEY_ENDED_AT = "endedAt"
    private const val KEY_STOP_REASON = "stopReason"
    private const val KEY_INTERRUPTED = "interrupted"
    private const val KEY_SEGMENTS = "segments"
    private const val KEY_SEGMENT_FILE = "file"
    private const val KEY_SEGMENT_DURATION_MS = "durationMs"

    /** Parses a persisted JSON blob. `null`/blank/invalid input maps to [SessionState.IDLE]. */
    fun parse(json: String?): SessionState {
        if (json.isNullOrBlank()) return SessionState.IDLE
        return try {
            val obj = JSONObject(json)
            val segmentsArray = obj.optJSONArray(KEY_SEGMENTS)
            val segments = mutableListOf<Segment>()
            if (segmentsArray != null) {
                for (i in 0 until segmentsArray.length()) {
                    val segObj = segmentsArray.getJSONObject(i)
                    segments.add(
                        Segment(
                            file = segObj.getString(KEY_SEGMENT_FILE),
                            durationMs = segObj.getLong(KEY_SEGMENT_DURATION_MS),
                        )
                    )
                }
            }
            SessionState(
                phase = obj.optString(KEY_PHASE, SessionState.PHASE_IDLE),
                sessionId = obj.optStringOrNull(KEY_SESSION_ID),
                startedAt = obj.optLongOrNull(KEY_STARTED_AT),
                endedAt = obj.optLongOrNull(KEY_ENDED_AT),
                stopReason = obj.optStringOrNull(KEY_STOP_REASON),
                interrupted = obj.optBooleanOrNull(KEY_INTERRUPTED),
                segments = segments,
            )
        } catch (e: Exception) {
            // Corrupt/unparseable state must never crash the app — treat it
            // as if no session had ever been recorded.
            SessionState.IDLE
        }
    }

    /** Serializes to the JSON blob persisted in SharedPreferences. */
    fun serialize(state: SessionState): String {
        val obj = JSONObject()
        obj.put(KEY_PHASE, state.phase)
        state.sessionId?.let { obj.put(KEY_SESSION_ID, it) }
        state.startedAt?.let { obj.put(KEY_STARTED_AT, it) }
        state.endedAt?.let { obj.put(KEY_ENDED_AT, it) }
        state.stopReason?.let { obj.put(KEY_STOP_REASON, it) }
        state.interrupted?.let { obj.put(KEY_INTERRUPTED, it) }
        val segmentsArray = JSONArray()
        for (segment in state.segments) {
            val segObj = JSONObject()
            segObj.put(KEY_SEGMENT_FILE, segment.file)
            segObj.put(KEY_SEGMENT_DURATION_MS, segment.durationMs)
            segmentsArray.put(segObj)
        }
        obj.put(KEY_SEGMENTS, segmentsArray)
        return obj.toString()
    }

    /** A brand-new 'recording' state for a freshly started session (no segments yet). */
    fun startRecording(sessionId: String, startedAt: Long): SessionState =
        SessionState(phase = SessionState.PHASE_RECORDING, sessionId = sessionId, startedAt = startedAt)

    /** Appends a just-finalized segment (rotation or final stop) to a 'recording' state. */
    fun appendSegment(state: SessionState, segment: Segment): SessionState =
        state.copy(segments = state.segments + segment)

    /** Transitions to 'stopped' with the given reason/interrupted flag and end timestamp. */
    fun stop(state: SessionState, stopReason: String, interrupted: Boolean, endedAt: Long): SessionState =
        state.copy(
            phase = SessionState.PHASE_STOPPED,
            endedAt = endedAt,
            stopReason = stopReason,
            interrupted = interrupted,
        )

    /**
     * The liveness check that makes `getStatus()` the source of truth across
     * WebView recreation, process death, force-stop, and reboot: if the
     * persisted state claims `phase == 'recording'` but the recording
     * foreground service is not actually alive (`isRunning == false`), the
     * process died mid-recording without reaching any of
     * `RecordingService.finalize`'s stop paths. Rewrite the state as
     * stopped/interrupted/'error', with `endedAt` derived from the last
     * durations we actually know about (`startedAt + sum(finalized segment
     * durations)`) rather than the current wall clock, since we have no idea
     * how long ago the process actually died.
     *
     * A no-op (returns `state` unchanged) for every other phase/liveness
     * combination.
     */
    fun checkLiveness(state: SessionState, isRunning: Boolean): SessionState {
        if (state.phase != SessionState.PHASE_RECORDING || isRunning) return state
        val startedAt = state.startedAt ?: 0L
        val endedAt = startedAt + state.totalDurationMs()
        return state.copy(
            phase = SessionState.PHASE_STOPPED,
            endedAt = endedAt,
            stopReason = SessionState.STOP_REASON_ERROR,
            interrupted = true,
        )
    }
}

private fun JSONObject.optStringOrNull(key: String): String? =
    if (has(key) && !isNull(key)) getString(key) else null

private fun JSONObject.optLongOrNull(key: String): Long? =
    if (has(key) && !isNull(key)) getLong(key) else null

private fun JSONObject.optBooleanOrNull(key: String): Boolean? =
    if (has(key) && !isNull(key)) getBoolean(key) else null
