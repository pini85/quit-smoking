package app.unsmoke.snore

import android.Manifest
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.os.StatFs
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONException

private const val ALIAS_MICROPHONE = "microphone"
internal const val ALIAS_NOTIFICATIONS = "notifications"
private const val MIN_FREE_BYTES = 500L * 1024 * 1024
private const val STOP_POLL_TIMEOUT_MS = 5_000L
private const val STOP_POLL_INTERVAL_MS = 50L
private const val FEATURES_FILE_NAME = "features.bin"
private const val CLIPS_DIR_NAME = "snore/clips"

/**
 * Allowed characters for a clip id (`cutClips`) or a `deleteSessionAudio`
 * sessionId: used verbatim as a path segment under `filesDir`, so this
 * whitelist is what makes path traversal via those ids impossible (`..`,
 * `/`, null bytes, etc. all fail this match and are rejected outright,
 * never sanitized/stripped down to something "safe").
 */
private val SAFE_ID_PATTERN = Regex("^[A-Za-z0-9_-]+$")

private fun isSafeId(id: String): Boolean = SAFE_ID_PATTERN.matches(id)

/** One parsed `cutClips` request-array entry, session-relative-ms range plus the caller-supplied output id. */
private data class ClipRequest(val id: String, val startMs: Long, val endMs: Long)

/** Generous safety-net timeout for the extraction wake lock — overnight sessions can be several hours of audio to decode. */
private const val EXTRACTION_WAKE_LOCK_TIMEOUT_MS = 30 * 60 * 1000L

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

    /**
     * Guards `extractFeatures`/`cutClips` (a later task) against running
     * concurrently — both are potentially long-running decode jobs against
     * the same session's files, so a second call while one is still in
     * flight is rejected outright (`ALREADY_PROCESSING`) rather than queued
     * or run in parallel.
     */
    private val processing = AtomicBoolean(false)

    /**
     * Single dedicated background thread for `extractFeatures`/`cutClips`
     * work: decoding is too slow to run on Capacitor's shared bridge
     * task-handler thread (blocking it would stall every other in-flight
     * plugin call across the whole app, the same reasoning as
     * `stopActiveRecording`'s dedicated poll thread), and a single thread
     * (rather than a pool) is all that's needed since [processing] already
     * only ever allows one job at a time.
     */
    private val executor = Executors.newSingleThreadExecutor()

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
        // isSafeId is required here, not just isNullOrBlank: sessionId is
        // later used verbatim as a path segment under filesDir (by every
        // other method in this file, via RecordingService.sessionDirFor /
        // the clips directory), so an unsafe sessionId accepted HERE is a
        // path-traversal hole reachable from every one of them -- closing
        // it only downstream (e.g. in cutClips) would leave this, the
        // actual entry point, unguarded.
        if (sessionId.isNullOrBlank() || !isSafeId(sessionId)) {
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
        // recording.
        //
        // That overwrite is also the LAST moment the old session's audio is
        // reachable at all: SessionStore holds exactly one session, and
        // deleteSessionAudio only acts on the session the store currently
        // matches, so once this write lands, the previous session's segments
        // and features.bin can never be deleted through any API again. A full
        // night of bedroom audio surviving as an unreachable orphan is not an
        // acceptable outcome for a feature whose UI promises the recording is
        // always deleted, so delete that directory here.
        //
        // Best-effort, and deliberately not fatal to the start: failing to
        // clean up yesterday must never stop the user recording tonight.
        // Skipped entirely while `processing` is held — an extraction or clip
        // cut may still be reading those very files, and yanking them
        // mid-decode would turn a clean failure into a corrupt one.
        if (current.phase == SessionState.PHASE_STOPPED && !processing.get()) {
            current.sessionId?.let { staleId ->
                if (isSafeId(staleId)) {
                    runCatching {
                        RecordingService.sessionDirFor(context.filesDir, staleId).deleteRecursively()
                    }
                }
            }
        }

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

    /**
     * Decodes every finalized segment of a STOPPED session into
     * `sessions/<sessionId>/features.bin` and resolves with its path plus
     * the frozen `hopMs`/`sampleRate` constants (the frame layout is fixed
     * — see `FeatureMath`/`FeaturesFileWriter` — so these are computed from
     * those constants, never hardcoded as separate literals that could
     * drift out of sync).
     *
     * Rejects `SESSION_NOT_FOUND` for both kinds of "wrong session"
     * misuse the frozen TS contract (`lib/native/snoreMonitor.ts`) allows
     * here: [sessionId] not matching what [SessionStore] currently holds,
     * AND the store not being in the `'stopped'` phase at all (nothing to
     * extract from a session that's still recording, or from a completely
     * idle store) — both mean "no known recording matches this call",
     * which is exactly what `SESSION_NOT_FOUND` means per that contract's
     * doc comment. Rejects `ALREADY_PROCESSING` if a previous
     * `extractFeatures`/`cutClips` call for this plugin instance hasn't
     * finished yet.
     */
    @PluginMethod
    fun extractFeatures(call: PluginCall) {
        val sessionId = call.getString("sessionId")
        // isSafeId, not just isNullOrBlank: sessionId is used verbatim as a
        // path segment below (RecordingService.sessionDirFor) -- see
        // startRecording's doc for why every entry point that accepts a
        // caller-supplied sessionId must apply this same check, not just
        // the ones that construct a NEW path from it.
        if (sessionId.isNullOrBlank() || !isSafeId(sessionId)) {
            call.reject("sessionId is required", "INVALID_ARGUMENT")
            return
        }

        val status = sessionStore.getStatus()
        if (status.phase != SessionState.PHASE_STOPPED || status.sessionId != sessionId) {
            call.reject("No stopped session matches sessionId=$sessionId", "SESSION_NOT_FOUND")
            return
        }

        if (!processing.compareAndSet(false, true)) {
            call.reject("An extraction or clip cut is already running for this session", "ALREADY_PROCESSING")
            return
        }

        // Normally already created by RecordingService when the session
        // started; re-asserted here defensively (a no-op if it already
        // exists) so FeaturesFileWriter's RandomAccessFile never fails on a
        // missing parent directory.
        val sessionDir = RecordingService.sessionDirFor(context.filesDir, sessionId).apply { mkdirs() }
        val outFile = File(sessionDir, FEATURES_FILE_NAME)
        val segments = status.segments.map { SegmentInfo(it.file) }
        val startedAtEpochMs = status.startedAt ?: 0L

        executor.execute {
            var wakeLock: PowerManager.WakeLock? = null
            try {
                wakeLock = acquireExtractionWakeLock()
                val frameCount = FeatureExtractor.extract(sessionDir, segments, outFile, startedAtEpochMs)
                call.resolve(
                    JSObject().apply {
                        put("featuresPath", outFile.absolutePath)
                        put("frameCount", frameCount)
                        put("hopMs", FeatureMath.FRAME_SIZE * 1000 / FeatureMath.SAMPLE_RATE_HZ)
                        put("sampleRate", FeatureMath.SAMPLE_RATE_HZ)
                    },
                )
            } catch (e: Exception) {
                // Never log audio content -- only the exception's own
                // (non-audio) message, e.g. a sample-rate mismatch or a
                // decode failure reason.
                call.reject("Feature extraction failed: ${e.message}", "EXTRACTION_FAILED")
            } finally {
                wakeLock?.let { if (it.isHeld) it.release() }
                processing.set(false)
            }
        }
    }

    private fun acquireExtractionWakeLock(): PowerManager.WakeLock {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val lock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "app.unsmoke:SnoreFeatureExtraction")
        lock.acquire(EXTRACTION_WAKE_LOCK_TIMEOUT_MS)
        return lock
    }

    /**
     * Cuts each requested `[startMs, endMs)` session-relative range out of a
     * STOPPED session's segments into its own standalone `.m4a` file under
     * `filesDir/snore/clips/<sessionId>/<id>.m4a`. Shares [processing] and
     * [executor] with [extractFeatures] — see their docs — since both are
     * long-running decode/mux jobs against the same session's files and must
     * never run concurrently with each other.
     *
     * Rejects `SESSION_NOT_FOUND` (session must be `'stopped'` and match
     * [sessionId]) and `ALREADY_PROCESSING`, exactly like [extractFeatures].
     * Each `clips[].id` is validated against [isSafeId] BEFORE any work
     * starts (and before [processing] is even claimed) — an invalid id
     * rejects the whole call with `INVALID_ARGUMENT` rather than silently
     * dropping just that one entry, since it is caller-side malformed input,
     * not a legitimate "this range doesn't exist" case. A range that
     * [ClipMapper.mapRange] maps to `null` (out of bounds / collapses to
     * zero-length after clamping) is different: that IS a legitimate outcome
     * for an otherwise well-formed request, so it is simply omitted from the
     * resolved `clips` array rather than failing the call.
     */
    @PluginMethod
    fun cutClips(call: PluginCall) {
        val sessionId = call.getString("sessionId")
        // isSafeId is REQUIRED here (not just the equality-match against
        // sessionStore below): sessionId becomes a directory path segment
        // for both sessionDir and clipsDir further down, and the equality
        // check alone is not a sound path-traversal defense on its own --
        // startRecording persists whatever string it was given, so without
        // this check here too, an unsafe sessionId that made it past
        // startRecording (see that method's doc) would still reach
        // File(...) construction in THIS method. Kept here as defense in
        // depth even though startRecording now also rejects it at the root.
        if (sessionId.isNullOrBlank() || !isSafeId(sessionId)) {
            call.reject("sessionId is required", "INVALID_ARGUMENT")
            return
        }

        val status = sessionStore.getStatus()
        if (status.phase != SessionState.PHASE_STOPPED || status.sessionId != sessionId) {
            call.reject("No stopped session matches sessionId=$sessionId", "SESSION_NOT_FOUND")
            return
        }

        val clipsArray = call.getArray("clips")
        if (clipsArray == null || clipsArray.length() == 0) {
            call.reject("clips is required", "INVALID_ARGUMENT")
            return
        }

        val requests = mutableListOf<ClipRequest>()
        try {
            for (i in 0 until clipsArray.length()) {
                val entry = clipsArray.getJSONObject(i)
                val id = entry.getString("id")
                if (!isSafeId(id)) {
                    call.reject("Invalid clip id (must match [A-Za-z0-9_-]+)", "INVALID_ARGUMENT")
                    return
                }
                requests.add(ClipRequest(id, entry.getLong("startMs"), entry.getLong("endMs")))
            }
        } catch (e: JSONException) {
            call.reject("Malformed clips entry: ${e.message}", "INVALID_ARGUMENT")
            return
        }

        if (!processing.compareAndSet(false, true)) {
            call.reject("An extraction or clip cut is already running for this session", "ALREADY_PROCESSING")
            return
        }

        val sessionDir = RecordingService.sessionDirFor(context.filesDir, sessionId)
        val segments = status.segments.map { SegmentSpan(it.file, it.durationMs) }
        val clipsDir = File(File(context.filesDir, CLIPS_DIR_NAME), sessionId).apply { mkdirs() }

        executor.execute {
            var wakeLock: PowerManager.WakeLock? = null
            try {
                wakeLock = acquireExtractionWakeLock()
                val results = JSArray()
                for (request in requests) {
                    // Out-of-bounds/zero-length-after-clamping ranges are a
                    // legitimate outcome, not an error -- skip (omit from
                    // results) rather than failing the whole batch.
                    val slice = ClipMapper.mapRange(segments, request.startMs, request.endMs) ?: continue
                    val outFile = File(clipsDir, "${request.id}.m4a")
                    ClipCutter.cut(sessionDir, slice, outFile)
                    results.put(
                        JSObject().apply {
                            put("id", request.id)
                            put("path", outFile.absolutePath)
                            put("durationMs", slice.durationMs)
                        },
                    )
                }
                call.resolve(JSObject().apply { put("clips", results) })
            } catch (e: Exception) {
                // The exception's CLASS NAME only, never e.message: this
                // catch wraps ClipCutter.cut, which touches real segment/clip
                // files, and e.message on a file-related exception (e.g.
                // FileNotFoundException) conventionally embeds the full
                // offending path -- exactly the "never log/return full
                // paths" rule this file follows elsewhere. Matches
                // FeatureExtractor's own convention (its onSegmentFailed
                // logging also uses only e.javaClass.simpleName).
                call.reject("Clip cut failed: ${e.javaClass.simpleName}", "EXTRACTION_FAILED")
            } finally {
                wakeLock?.let { if (it.isHeld) it.release() }
                processing.set(false)
            }
        }
    }

    /**
     * Deletes a STOPPED session's on-disk audio: always the segments +
     * `features.bin` under `filesDir/snore/sessions/<sessionId>/`, and —
     * unless [keepClips] is `true` — also `filesDir/snore/clips/<sessionId>/`.
     * Transitions [sessionStore] to `'idle'` afterward via
     * [SessionStore.clearIfMatches] so a subsequent `getStatus()` no longer
     * reports this session — UNLESS a fresh `startRecording` for a different
     * session raced ahead of this call between the status read above and
     * that clear (see [SessionStore.clearIfMatches]'s doc): in that case the
     * clear is skipped as a no-op, deliberately NOT rolled back or retried,
     * since the delete itself already succeeded and clobbering the newer
     * session's state would be strictly worse.
     *
     * Runs synchronously on the calling (Capacitor bridge) thread: this is
     * plain filesystem deletion, not a decode/mux job, so it does not need
     * [executor]/a wake lock the way [extractFeatures]/[cutClips] do. It
     * DOES still check [processing], though (rejecting `ALREADY_PROCESSING`
     * if an extraction or cut is currently running against this session's
     * segment files) — deleting those files out from under an in-flight
     * `MediaExtractor`/`MediaCodec` read would surface as a spurious
     * mid-decode failure there instead of a clean, retryable rejection here.
     * The caller can simply retry once that call finishes.
     *
     * [sessionId] is validated against [isSafeId] like a clip id (same
     * path-traversal concern: it becomes a path segment under `filesDir`),
     * and, like [extractFeatures]/[cutClips], must match the currently
     * stored session (also `'stopped'` — a session's own files must never be
     * deleted while it is still actively recording) or this rejects
     * `SESSION_NOT_FOUND`.
     */
    @PluginMethod
    fun deleteSessionAudio(call: PluginCall) {
        val sessionId = call.getString("sessionId")
        if (sessionId.isNullOrBlank() || !isSafeId(sessionId)) {
            call.reject("sessionId is required", "INVALID_ARGUMENT")
            return
        }

        val status = sessionStore.getStatus()
        if (status.phase != SessionState.PHASE_STOPPED || status.sessionId != sessionId) {
            call.reject("No stopped session matches sessionId=$sessionId", "SESSION_NOT_FOUND")
            return
        }

        if (processing.get()) {
            call.reject(
                "An extraction or clip cut is still running for this session; retry once it finishes",
                "ALREADY_PROCESSING",
            )
            return
        }

        val keepClips = call.getBoolean("keepClips", false) ?: false

        RecordingService.sessionDirFor(context.filesDir, sessionId).deleteRecursively()
        if (!keepClips) {
            File(File(context.filesDir, CLIPS_DIR_NAME), sessionId).deleteRecursively()
        }

        sessionStore.clearIfMatches(sessionId)
        call.resolve()
    }

    /**
     * Deletes each of [paths] (already-absolute clip file paths, as returned
     * by [cutClips]). Idempotent: a path that no longer exists is simply
     * skipped, not an error.
     *
     * Every path is canonicalized ([File.canonicalFile], which resolves
     * `..`/symlinks) and required to fall UNDER `filesDir/snore/clips/`
     * BEFORE any deletion happens — if even one fails that containment
     * check, the WHOLE call is rejected `INVALID_PATH` and nothing is
     * deleted, rather than silently deleting only the valid-looking prefix
     * of the array. This is the complementary path-traversal guard to
     * [isSafeId]'s whitelist: [cutClips]/[deleteSessionAudio] construct
     * paths themselves from short ids, but this call is handed full paths
     * by the caller, so containment-under-the-clips-root is checked
     * directly instead.
     */
    @PluginMethod
    fun deleteClips(call: PluginCall) {
        val pathsArray = call.getArray("paths")
        if (pathsArray == null) {
            call.reject("paths is required", "INVALID_ARGUMENT")
            return
        }

        val clipsRoot = File(context.filesDir, CLIPS_DIR_NAME).canonicalFile
        val targets = mutableListOf<File>()
        try {
            for (i in 0 until pathsArray.length()) {
                val rawPath = pathsArray.getString(i)
                val canonical = File(rawPath).canonicalFile
                if (!isUnderDirectory(canonical, clipsRoot)) {
                    call.reject("Path is not under the clips directory", "INVALID_PATH")
                    return
                }
                targets.add(canonical)
            }
        } catch (e: JSONException) {
            call.reject("Malformed paths entry: ${e.message}", "INVALID_ARGUMENT")
            return
        }

        // Missing files are fine here (idempotent) -- delete() simply
        // returns false for a path that no longer exists.
        targets.forEach { it.delete() }
        call.resolve()
    }

    private fun isUnderDirectory(file: File, dir: File): Boolean =
        file.path.startsWith(dir.path + File.separator)

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
