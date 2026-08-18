package app.unsmoke.snore

import android.content.Context
import android.content.SharedPreferences

/**
 * Thin SharedPreferences shell around [SessionStateCodec]'s pure logic —
 * intentionally not unit-tested itself (see `SessionStoreTest.kt`, which
 * tests the pure codec instead). Every transition is written with
 * `commit()` (synchronous, not `apply()`) so that a process death
 * immediately after a write can never race ahead of the persisted state —
 * [RecordingService] relies on that durability for every segment rotation
 * and stop path.
 *
 * All methods are `synchronized` because [RecordingService] (its own
 * thread/callbacks) and [SnoreMonitorPlugin] (the Capacitor bridge thread)
 * both read and write this store.
 */
class SessionStore(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Reads the persisted state and applies the liveness check
     * (`SessionStateCodec.checkLiveness`) against [RecordingService.isRunning].
     * If the check rewrites the state (process died mid-recording), the
     * rewritten state is persisted before being returned, so subsequent
     * reads see the same answer without re-deriving it.
     */
    @Synchronized
    fun getStatus(): SessionState {
        val raw = read()
        val checked = SessionStateCodec.checkLiveness(raw, RecordingService.isRunning)
        if (checked !== raw) {
            write(checked)
        }
        return checked
    }

    /**
     * Starts a brand-new recording session, unconditionally overwriting
     * whatever was persisted before.
     *
     * NOTE (controller ruling): this is also the path taken when the
     * previous state was `phase == 'stopped'` (a stale, unclaimed session —
     * one whose `stopRecording()` result nobody ever claimed). Rather than
     * rejecting, `startRecording` deliberately proceeds and overwrites the
     * store with the new session. The old session's audio files are
     * deliberately left on disk here: session recovery (a later task) marks
     * that old row 'lost' once it sees native has no memory of it anymore,
     * and `deleteSessionAudio` (also a later task) is what actually cleans
     * its files up.
     */
    @Synchronized
    fun startRecording(sessionId: String, startedAt: Long): SessionState {
        val state = SessionStateCodec.startRecording(sessionId, startedAt)
        write(state)
        return state
    }

    /** Appends a finalized segment (rotation or final stop) to the current state. */
    @Synchronized
    fun appendSegment(file: String, durationMs: Long): SessionState {
        val state = SessionStateCodec.appendSegment(read(), Segment(file, durationMs))
        write(state)
        return state
    }

    /**
     * Transitions to 'stopped'. Idempotent in effect: calling this again
     * while already 'stopped' would simply overwrite with an equivalent
     * state, but in practice [RecordingService] only ever calls this once
     * per session (guarded by its own `finalizing` flag) — repeated
     * `stopRecording()` plugin calls against an already-'stopped' session
     * read this persisted state without going through this method at all,
     * which is what keeps them idempotent (see `SnoreMonitorPlugin`'s doc).
     */
    @Synchronized
    fun stop(stopReason: String, interrupted: Boolean, endedAt: Long): SessionState {
        val state = SessionStateCodec.stop(read(), stopReason, interrupted, endedAt)
        write(state)
        return state
    }

    @Synchronized
    private fun read(): SessionState = SessionStateCodec.parse(prefs.getString(KEY_STATE, null))

    @Synchronized
    private fun write(state: SessionState) {
        prefs.edit().putString(KEY_STATE, SessionStateCodec.serialize(state)).commit()
    }

    companion object {
        const val PREFS_NAME = "snore_session"
        private const val KEY_STATE = "state"
    }
}
