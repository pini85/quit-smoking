package app.unsmoke.snore

import android.Manifest
import android.content.Intent
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
 *
 * `checkPermissions`/`requestPermissions` are intentionally NOT overridden
 * here: the base `Plugin` class already implements both generically from
 * the `@CapacitorPlugin.permissions` annotation below, resolving
 * `{ microphone, notifications }` PermissionState values keyed by alias. On
 * API < 33 (no runtime POST_NOTIFICATIONS permission), `ActivityCompat`
 * reports that check as already granted, which is exactly the "reports
 * 'granted'" behavior this plugin needs there — no extra code required.
 */
@CapacitorPlugin(
    name = "SnoreMonitor",
    permissions = [
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = ALIAS_MICROPHONE),
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications"),
    ],
)
class SnoreMonitorPlugin : Plugin() {

    private lateinit var sessionStore: SessionStore

    override fun load() {
        super.load()
        sessionStore = SessionStore(context)
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
        ContextCompat.startForegroundService(context, intent)

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
        ContextCompat.startForegroundService(context, intent)

        // RecordingService finalizes asynchronously (it has to stop/release
        // the MediaRecorder and measure the last segment's real duration),
        // so poll SessionStore on a background thread until it reports
        // 'stopped', rather than blocking the bridge thread.
        execute {
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
