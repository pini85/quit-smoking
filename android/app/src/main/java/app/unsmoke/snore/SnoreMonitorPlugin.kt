package app.unsmoke.snore

import android.Manifest
import android.content.Intent
import android.os.Build
import android.os.StatFs
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission

private const val ALIAS_MICROPHONE = "microphone"
internal const val ALIAS_NOTIFICATIONS = "notifications"
private const val MIN_FREE_BYTES = 500L * 1024 * 1024
private const val STOP_POLL_TIMEOUT_MS = 5_000L
private const val STOP_POLL_INTERVAL_MS = 50L

/**
 * Capacitor bridge for the native overnight audio recorder. This is a thin
 * mapping layer only — [SessionStore] (via [RecordingService]) owns all
 * session state; this plugin never keeps any of its own. Every field name,
 * phase/stopReason string, and error code below must match
 * `lib/native/snoreMonitor.ts` (the frozen TS contract) exactly, since the
 * JS/native bridge is stringly-typed.
 */
@CapacitorPlugin(
    name = "SnoreMonitor",
    permissions = [
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = ALIAS_MICROPHONE),
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = ALIAS_NOTIFICATIONS),
    ],
)
class SnoreMonitorPlugin : Plugin() {

    private lateinit var sessionStore: SessionStore

    override fun load() {
        super.load()
        sessionStore = SessionStore(context)
    }

    /**
     * Overridden (rather than relying on the base `Plugin` implementation
     * as-is) to normalize its result into exactly the frozen
     * `PermissionState` union (`'granted' | 'denied' | 'prompt'`) from
     * `lib/native/snoreMonitor.ts`:
     * - Capacitor's own `PermissionState` has a fourth value,
     *   `PROMPT_WITH_RATIONALE` (shown after a first denial, before
     *   re-prompting) — collapsed to `'prompt'` here so it never escapes the
     *   contract.
     * - `POST_NOTIFICATIONS` is only a real runtime permission from API 33
     *   onward; below that, `ActivityCompat.checkSelfPermission` reports it
     *   as not granted (there's nothing to grant), which would surface as
     *   `'denied'`/`'prompt'` instead of the brief-mandated `'granted'`. The
     *   `notifications` alias is short-circuited to `'granted'` on those
     *   older OS versions.
     *
     * `requestPermissions` is NOT overridden separately: the base `Plugin`
     * implementation always ends by invoking a same-named permission
     * callback method — `"checkPermissions"` — via reflection on `this`,
     * which Java's normal virtual dispatch resolves to THIS override (not
     * the base declaration it was looked up from), so the same
     * normalization applies to `requestPermissions()`'s result too.
     */
    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val states = getPermissionStates()
        call.resolve(
            JSObject().apply {
                put(ALIAS_MICROPHONE, PermissionNormalization.normalize(ALIAS_MICROPHONE, states[ALIAS_MICROPHONE], Build.VERSION.SDK_INT))
                put(
                    ALIAS_NOTIFICATIONS,
                    PermissionNormalization.normalize(ALIAS_NOTIFICATIONS, states[ALIAS_NOTIFICATIONS], Build.VERSION.SDK_INT),
                )
            },
        )
    }

    @PluginMethod
    fun startRecording(call: PluginCall) {
        val sessionId = call.getString("sessionId")
        if (sessionId.isNullOrBlank()) {
            call.reject("sessionId is required", "INVALID_ARGUMENT")
            return
        }

        val current = sessionStore.getStatus()
        if (current.phase == SessionState.PHASE_RECORDING) {
            call.resolve(
                JSObject().apply {
                    put("sessionId", current.sessionId)
                    put("startedAt", current.startedAt)
                    put("alreadyRunning", true)
                },
            )
            return
        }

        if (getPermissionState(ALIAS_MICROPHONE) != PermissionState.GRANTED) {
            call.reject("Microphone permission not granted", "PERMISSION_DENIED")
            return
        }

        if (!hasEnoughStorage()) {
            call.reject("Insufficient storage to start a recording", "LOW_STORAGE")
            return
        }

        // NOTE (controller ruling): when `current.phase == 'stopped'` — a
        // stale, unclaimed previous session — this deliberately PROCEEDS
        // rather than rejecting, overwriting SessionStore with the new
        // recording. See `SessionStore.startRecording`'s doc for why the old
        // session's files are left on disk rather than cleaned up here.
        val startedAt = System.currentTimeMillis()
        sessionStore.startRecording(sessionId, startedAt)

        val intent = Intent(context, RecordingService::class.java).apply {
            action = RecordingService.ACTION_START
            putExtra(RecordingService.EXTRA_SESSION_ID, sessionId)
        }
        try {
            ContextCompat.startForegroundService(context, intent)
        } catch (e: Exception) {
            // SecurityException / ForegroundServiceStartNotAllowedException
            // (API 31+, background-start restrictions) would otherwise
            // propagate up through the Capacitor bridge and crash the
            // process instead of just failing this one promise. SessionStore
            // is deliberately left as 'recording' here rather than rolled
            // back: the next getStatus() call's liveness check
            // (RecordingService.isRunning stays false — the service never
            // actually started) will self-heal it to 'stopped'/'error'.
            call.reject("Unable to start the recording foreground service: ${e.message}", "PERMISSION_DENIED")
            return
        }

        call.resolve(
            JSObject().apply {
                put("sessionId", sessionId)
                put("startedAt", startedAt)
                put("alreadyRunning", false)
            },
        )
    }

    @PluginMethod
    fun stopRecording(call: PluginCall) {
        val status = sessionStore.getStatus()
        when (status.phase) {
            SessionState.PHASE_IDLE -> call.reject("No recording in progress", "NOT_RECORDING")
            // Idempotent-when-stopped: repeated calls against an already
            // 'stopped', unclaimed session simply keep returning the same
            // persisted StopResult, without consuming/clearing any state.
            // Only `deleteSessionAudio` (a later task) or a fresh
            // `startRecording` ever transitions state away from 'stopped' —
            // the web recovery layer (`sleepSessionService.recoverOnLaunch`)
            // depends on being able to call this more than once safely.
            SessionState.PHASE_STOPPED -> call.resolve(stopResultOf(status))
            SessionState.PHASE_RECORDING -> stopActiveRecording(call)
            else -> call.reject("Unknown session phase", "NOT_RECORDING")
        }
    }

    private fun stopActiveRecording(call: PluginCall) {
        val intent = Intent(context, RecordingService::class.java).apply {
            action = RecordingService.ACTION_STOP
            putExtra(RecordingService.EXTRA_STOP_REASON, SessionState.STOP_REASON_USER)
        }
        try {
            ContextCompat.startForegroundService(context, intent)
        } catch (e: Exception) {
            // The recording keeps running natively if this signal never
            // lands; nothing has been consumed here, so a retried
            // stopRecording() call is safe.
            call.reject("Unable to signal the recording service to stop: ${e.message}", "NOT_RECORDING")
            return
        }

        // RecordingService finalizes asynchronously (it has to stop/release
        // the MediaRecorder and measure the last segment's real duration on
        // its own worker thread), so poll SessionStore until it reports
        // 'stopped' on a dedicated, short-lived daemon thread — NOT
        // Capacitor's shared bridge task-handler thread (`Plugin.execute`),
        // which every plugin call in the whole app funnels through; blocking
        // that thread here for up to 5s would stall every other in-flight
        // plugin call, not just this one.
        Thread({
            val deadline = System.currentTimeMillis() + STOP_POLL_TIMEOUT_MS
            var polled = sessionStore.getStatus()
            while (polled.phase != SessionState.PHASE_STOPPED && System.currentTimeMillis() < deadline) {
                Thread.sleep(STOP_POLL_INTERVAL_MS)
                polled = sessionStore.getStatus()
            }
            if (polled.phase == SessionState.PHASE_STOPPED) {
                call.resolve(stopResultOf(polled))
            } else {
                call.reject("Timed out waiting for the recording to stop", "NOT_RECORDING")
            }
        }, "SnoreMonitorStopPoll").apply {
            isDaemon = true
            start()
        }
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val status = sessionStore.getStatus()
        val result = JSObject()
        result.put("phase", status.phase)
        status.sessionId?.let { result.put("sessionId", it) }
        status.startedAt?.let { result.put("startedAt", it) }
        when (status.phase) {
            SessionState.PHASE_RECORDING -> {
                status.startedAt?.let { result.put("elapsedMs", System.currentTimeMillis() - it) }
            }
            SessionState.PHASE_STOPPED -> {
                status.endedAt?.let { endedAt ->
                    result.put("endedAt", endedAt)
                    status.startedAt?.let { startedAt -> result.put("elapsedMs", endedAt - startedAt) }
                }
                status.interrupted?.let { result.put("interrupted", it) }
                status.stopReason?.let { result.put("stopReason", it) }
            }
        }
        call.resolve(result)
    }

    @PluginMethod
    fun extractFeatures(call: PluginCall) {
        call.unimplemented("extractFeatures is not yet implemented")
    }

    @PluginMethod
    fun cutClips(call: PluginCall) {
        call.unimplemented("cutClips is not yet implemented")
    }

    @PluginMethod
    fun deleteSessionAudio(call: PluginCall) {
        call.unimplemented("deleteSessionAudio is not yet implemented")
    }

    @PluginMethod
    fun deleteClips(call: PluginCall) {
        call.unimplemented("deleteClips is not yet implemented")
    }

    private fun stopResultOf(status: SessionState): JSObject = JSObject().apply {
        put("sessionId", status.sessionId)
        put("startedAt", status.startedAt)
        put("endedAt", status.endedAt)
        put("durationMs", status.totalDurationMs())
        put("interrupted", status.interrupted ?: false)
        put("stopReason", status.stopReason)
        put("segmentCount", status.segments.size)
    }

    private fun hasEnoughStorage(): Boolean {
        val stat = StatFs(context.filesDir.absolutePath)
        return stat.availableBytes >= MIN_FREE_BYTES
    }
}
