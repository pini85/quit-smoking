package app.unsmoke.snore

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaMetadataRetriever
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import android.os.StatFs
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import app.unsmoke.MainActivity
import app.unsmoke.R
import java.io.File
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Foreground microphone recording service. Owns the actual [MediaRecorder],
 * its segment rotation, and every path that can end a recording session.
 * [SessionStore] is the single source of truth for session state; this
 * service's only job is to drive the recorder and keep that store in sync.
 *
 * Deliberately has NO `BOOT_COMPLETED` receiver and never auto-resumes a
 * recording after the process is killed, the app is force-stopped, or the
 * device reboots. Two independent reasons, either one sufficient on its
 * own: (1) Android 12+ blocks starting a foreground service with the
 * microphone type from the background entirely, so an automatic resume
 * would frequently fail outright; (2) even where it could work, silently
 * turning the bedroom microphone back on without the user having just
 * pressed a button is a privacy anti-feature — recording must always be a
 * fresh, explicit, foregrounded user action. A crashed/killed session is
 * instead recovered as 'stopped'/interrupted by [SessionStore.getStatus]'s
 * liveness check the next time anything asks for status.
 *
 * All session-mutating work (starting/stopping the recorder, segment
 * rotation bookkeeping, MediaRecorder's own callbacks) runs on a single
 * dedicated [workerThread] rather than the main thread: `onStartCommand`
 * only calls `startForeground` synchronously (a hard platform requirement)
 * and otherwise just posts to that thread, so a slow `SessionStore.commit()`
 * or `MediaMetadataRetriever` read never blocks the main thread. The
 * `MediaRecorder` itself is also constructed there, so its
 * `OnInfoListener`/`OnErrorListener` callbacks (which fire on the thread
 * that created the recorder) land on the same thread as everything else —
 * no extra locking needed for this service's own mutable fields.
 */
class RecordingService : Service() {

    private val workerThread = HandlerThread("SnoreRecordingWorker")
    private lateinit var workerHandler: Handler

    private lateinit var sessionStore: SessionStore
    private var recorder: MediaRecorder? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var sessionDir: File? = null

    /** Index of the segment file currently receiving audio. */
    private var activeSegmentIndex = 0

    /** Index of the segment file queued via `setNextOutputFile`, if any. */
    private var queuedSegmentIndex: Int? = null

    /** Pending "rotation never completed" watchdog — see [armRotationWatchdog]. */
    private var rotationWatchdog: Runnable? = null

    /** `SystemClock.elapsedRealtime()` when [onSegmentRotated] last actually completed a rotation, or 0L if never. */
    private var lastRotationCompletedAtMs: Long = 0L

    /** Guards [finalize] so every stop path (intent/error/low-storage/watchdog/timeout/onDestroy) only runs once per session. */
    private var finalizing = false

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        sessionStore = SessionStore(applicationContext)
        workerThread.start()
        workerHandler = Handler(workerThread.looper)
        createNotificationChannel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Must be the very first thing done — for EVERY action, not just
        // ACTION_START: a stale PendingIntent (e.g. the notification's Stop
        // action, or a duplicate ACTION_STOP) can cause Android to spin up a
        // brand-new Service instance that never called startForeground yet,
        // and the platform treats "started via startForegroundService but
        // never called startForeground" as a crash-worthy violation
        // regardless of which action triggered the start. Guarded because
        // ForegroundServiceStartNotAllowedException (API 31+) / a plain
        // SecurityException are both real possibilities (e.g. background
        // start restrictions) — if we legally can't run as an FGS right
        // now, there is nothing to record; tear down instead of crashing
        // the process.
        try {
            startForeground(
                NOTIF_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
            )
        } catch (e: Exception) {
            stopSelf()
            return START_NOT_STICKY
        }

        val action = intent?.action
        val sessionIdExtra = intent?.getStringExtra(EXTRA_SESSION_ID)
        val stopReasonExtra = intent?.getStringExtra(EXTRA_STOP_REASON)
        workerHandler.post {
            when (action) {
                ACTION_START -> handleStart(sessionIdExtra)
                ACTION_STOP -> finalizeIfRecording(stopReasonExtra ?: SessionState.STOP_REASON_USER, interrupted = false)
                else -> {
                    // Unknown/missing action with no active recorder: nothing to do.
                    if (recorder == null) {
                        stopForeground(STOP_FOREGROUND_REMOVE)
                        stopSelf()
                    }
                }
            }
        }
        return START_NOT_STICKY
    }

    private fun handleStart(sessionId: String?) {
        if (recorder != null) {
            // Already actively recording — a second ACTION_START (e.g. a
            // duplicate plugin call) is a no-op; the foreground
            // notification/state established above is all that's needed.
            return
        }

        // A brand-new recording is starting on this Service instance.
        // Android is free to reuse the SAME instance for a fresh
        // ACTION_START shortly after a previous session's finalize()
        // already ran (stopSelf() only *requests* teardown — it does not
        // synchronously destroy the instance, so a subsequent
        // startForegroundService call can arrive and be handled by this
        // same object before onDestroy ever runs). Reset the finalize-guard
        // here, at the point a *new* session is confirmed to be starting,
        // rather than trying to reject/redirect to a new instance — this is
        // simpler and keeps all the per-session mutable state resets (segment
        // indices, session dir, watchdog) in one place.
        finalizing = false

        if (sessionId.isNullOrBlank()) {
            finalizeIfRecording(SessionState.STOP_REASON_ERROR, interrupted = true)
            return
        }

        if (!hasEnoughStorage()) {
            finalizeIfRecording(SessionState.STOP_REASON_LOW_STORAGE, interrupted = true)
            return
        }

        sessionDir = File(File(filesDir, "snore/sessions"), sessionId).apply { mkdirs() }
        activeSegmentIndex = 0
        queuedSegmentIndex = null
        acquireWakeLock()
        startRecorder()
    }

    private fun startRecorder() {
        val firstFile = segmentFile(activeSegmentIndex)
        // The no-arg MediaRecorder() constructor is deprecated in favor of
        // MediaRecorder(Context) since API 31, but minSdk here is 26.
        val newRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(this)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
        try {
            newRecorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            newRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            newRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            newRecorder.setAudioChannels(1)
            newRecorder.setAudioSamplingRate(AUDIO_SAMPLING_RATE)
            newRecorder.setAudioEncodingBitRate(AUDIO_ENCODING_BIT_RATE)
            newRecorder.setMaxDuration(SEGMENT_MAX_DURATION_MS)
            newRecorder.setOutputFile(firstFile.absolutePath)
            newRecorder.setOnInfoListener { _, what, _ ->
                when (what) {
                    MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED -> armRotationWatchdog()
                    MediaRecorder.MEDIA_RECORDER_INFO_NEXT_OUTPUT_FILE_STARTED -> {
                        cancelRotationWatchdog()
                        onSegmentRotated()
                    }
                }
            }
            newRecorder.setOnErrorListener { _, _, _ -> finalizeIfRecording(SessionState.STOP_REASON_ERROR, interrupted = true) }
            newRecorder.prepare()
            newRecorder.start()
        } catch (e: IOException) {
            newRecorder.release()
            finalizeIfRecording(SessionState.STOP_REASON_ERROR, interrupted = true)
            return
        } catch (e: RuntimeException) {
            newRecorder.release()
            finalizeIfRecording(SessionState.STOP_REASON_ERROR, interrupted = true)
            return
        }
        recorder = newRecorder
        queueNextSegment()
    }

    /** Called right after `start()` and again after each rotation, so the next file is always ready before the next boundary. */
    private fun queueNextSegment() {
        val current = recorder ?: return
        if (!hasEnoughStorage()) {
            finalizeIfRecording(SessionState.STOP_REASON_LOW_STORAGE, interrupted = true)
            return
        }
        val nextIndex = activeSegmentIndex + 1
        try {
            current.setNextOutputFile(segmentFile(nextIndex))
            queuedSegmentIndex = nextIndex
        } catch (e: IOException) {
            finalizeIfRecording(SessionState.STOP_REASON_ERROR, interrupted = true)
        } catch (e: IllegalStateException) {
            finalizeIfRecording(SessionState.STOP_REASON_ERROR, interrupted = true)
        }
    }

    /**
     * `MEDIA_RECORDER_INFO_MAX_DURATION_REACHED` fired but is otherwise a
     * no-op: the queued next file (from `setNextOutputFile`) is what lets
     * MediaRecorder switch automatically. But if the platform stops the
     * recorder at this boundary instead of rotating into that file (rather
     * than firing `NEXT_OUTPUT_FILE_STARTED`), nothing would ever notice —
     * `getStatus()` would keep reporting 'recording' forever while nothing
     * is actually being captured. Arm a short defensive timer that
     * force-finalizes as an error if the rotation genuinely never completes.
     *
     * (Considered also setting `setMaxFileSize` as a companion boundary —
     * decided against it: `MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED` is a
     * distinct info code that, unlike duration + `setNextOutputFile`, is not
     * documented to trigger an automatic seamless file switch, so it would
     * add a second, differently-behaved rotation trigger to reason about.
     * This watchdog already covers "rotation stalled for any reason,"
     * duration-based or not, without complicating the protocol.)
     *
     * ASSUMPTION this hardens against: `MEDIA_RECORDER_INFO_NEXT_OUTPUT_FILE_STARTED`
     * cancelling this watchdog (below) handles the documented, well-behaved
     * ordering fine. But `MEDIA_RECORDER_INFO_MAX_DURATION_REACHED` is only
     * ever observed as "the boundary was reached," not "the switch failed" —
     * some vendor `MediaRecorder` implementations are known to emit it
     * alongside, or even slightly after, a `NEXT_OUTPUT_FILE_STARTED` that
     * already completed the real rotation, or to re-fire a duplicate
     * `MAX_DURATION_REACHED` with no new rotation actually due. Blindly
     * force-finalizing whenever this timer fires would kill a perfectly
     * healthy overnight session at the very first 20-minute boundary on
     * those devices. The runnable itself re-checks at fire time (not just
     * at arm time) whether a rotation has completed, or the still-open
     * segment file has kept growing, since this watchdog was armed, and
     * no-ops (just clears itself) if either is true.
     */
    private fun armRotationWatchdog() {
        cancelRotationWatchdog()
        val armedAtMs = SystemClock.elapsedRealtime()
        val armedFileSizeBytes = segmentFile(activeSegmentIndex).length()
        val watchdog = Runnable {
            rotationWatchdog = null
            val rotatedSinceArm = lastRotationCompletedAtMs >= armedAtMs
            val stillGrowing = segmentFile(activeSegmentIndex).length() > armedFileSizeBytes
            if (!rotatedSinceArm && !stillGrowing) {
                finalizeIfRecording(SessionState.STOP_REASON_ERROR, interrupted = true)
            }
        }
        rotationWatchdog = watchdog
        workerHandler.postDelayed(watchdog, ROTATION_WATCHDOG_MS)
    }

    private fun cancelRotationWatchdog() {
        rotationWatchdog?.let { workerHandler.removeCallbacks(it) }
        rotationWatchdog = null
    }

    /** MediaRecorder just switched from `activeSegmentIndex` to `queuedSegmentIndex` — the former is now finalized on disk. */
    private fun onSegmentRotated() {
        val finishedIndex = activeSegmentIndex
        val nextIndex = queuedSegmentIndex
        val finishedFile = segmentFile(finishedIndex)
        val durationMs = measureDurationMs(finishedFile)
        sessionStore.appendSegment(finishedFile.name, durationMs)
        if (nextIndex != null) {
            activeSegmentIndex = nextIndex
            queuedSegmentIndex = null
        }
        queueNextSegment()
        // Marks that a real rotation just completed, for whichever watchdog
        // gets armed at the NEXT boundary (see armRotationWatchdog). Safe to
        // set unconditionally even when queueNextSegment() just triggered an
        // immediate finalize() (e.g. low storage/IO error right after
        // rotating): finalize() cancels any pending watchdog outright, so
        // there is no future watchdog left for this timestamp to matter to.
        lastRotationCompletedAtMs = SystemClock.elapsedRealtime()
    }

    /**
     * Guards [finalize] against running for a session this Service instance
     * was never actually driving: a stray `ACTION_STOP`/unknown action can
     * reach a *fresh* instance (Android creates one on demand for a stale
     * PendingIntent even after the real session's instance already finished
     * and was destroyed). In that case `recorder` is null here not because
     * this instance finished recording, but because it never started one —
     * blindly calling `finalize()` would stomp whatever `SessionStore`
     * currently holds (a liveness-recovered 'error' state, or plain 'idle')
     * with a fabricated 'stopped'/'user'/now, or even a phantom 'stopped'
     * session with no `sessionId`. Only proceed if `SessionStore` itself
     * still agrees a recording is live.
     *
     * This self-selects correctly for every OTHER caller too (storage guard
     * on start, prepare/start failure, error listener, rotation watchdog,
     * `onTimeout`): by the time any of those run, `SessionStore` already
     * has `phase == 'recording'` for THIS session (the plugin writes it
     * before ever starting this service), so the guard condition above is
     * false for them regardless of whether `recorder` happens to be null
     * yet (e.g. a `prepare()`/`start()` failure before the field is
     * assigned) — they always fall through to a real [finalize] without
     * needing to say so explicitly.
     */
    private fun finalizeIfRecording(stopReason: String, interrupted: Boolean) {
        if (finalizing) return
        if (recorder == null && sessionStore.getStatus().phase != SessionState.PHASE_RECORDING) {
            finalizing = true
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }
        finalize(stopReason, interrupted)
    }

    /**
     * Every stop path converges here: recorder stop/release, measuring the
     * final (still-open) segment, persisting the 'stopped' state, releasing
     * the wake lock, and tearing down the foreground service. Guarded by
     * [finalizing] so it only ever runs once per session no matter how many
     * of ACTION_STOP / the error listener / the low-storage guard / the
     * rotation watchdog / [onTimeout] / [onDestroy] fire. Always reached
     * through [finalizeIfRecording], never called directly.
     */
    private fun finalize(stopReason: String, interrupted: Boolean) {
        if (finalizing) return
        finalizing = true
        cancelRotationWatchdog()

        val activeRecorder = recorder
        recorder = null
        if (activeRecorder != null) {
            try {
                activeRecorder.stop()
            } catch (e: RuntimeException) {
                // stop() throws IllegalStateException if called before any
                // valid data was written (e.g. an immediate low-storage/error
                // stop) — the segment is simply zero-duration, not a crash.
            }
            try {
                activeRecorder.release()
            } catch (e: RuntimeException) {
                // Already released/invalid state — nothing further to do.
            }

            val activeFile = segmentFile(activeSegmentIndex)
            if (activeFile.exists()) {
                sessionStore.appendSegment(activeFile.name, measureDurationMs(activeFile))
            }

            // Best-effort cleanup of a next-file MediaRecorder had reserved
            // via setNextOutputFile but never actually wrote to.
            queuedSegmentIndex?.let { index ->
                val unusedFile = segmentFile(index)
                if (unusedFile.exists() && unusedFile.length() == 0L) {
                    unusedFile.delete()
                }
            }
        }

        sessionStore.stop(stopReason, interrupted, System.currentTimeMillis())
        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun measureDurationMs(file: File): Long {
        if (!file.exists() || file.length() == 0L) return 0L
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            retriever
                .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull() ?: 0L
        } catch (e: RuntimeException) {
            0L
        } finally {
            retriever.release()
        }
    }

    private fun hasEnoughStorage(): Boolean {
        val stat = StatFs(filesDir.absolutePath)
        val availableBytes = stat.availableBytes
        return availableBytes >= MIN_FREE_BYTES
    }

    private fun segmentFile(index: Int): File {
        val dir = sessionDir ?: filesDir
        return File(dir, "seg_%04d.m4a".format(index))
    }

    private fun acquireWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        val lock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "app.unsmoke:SnoreRecording")
        // A generous timeout as a safety net only — normal releases always
        // happen explicitly in finalize()/onDestroy() well before this.
        lock.acquire(MAX_WAKE_LOCK_DURATION_MS)
        wakeLock = lock
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }

    private fun createNotificationChannel() {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            NOTIF_CHANNEL_ID,
            getString(R.string.snore_notification_channel_name),
            NotificationManager.IMPORTANCE_LOW,
        )
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val contentIntent = Intent(this, MainActivity::class.java)
        val contentPendingIntent = PendingIntent.getActivity(
            this,
            0,
            contentIntent,
            PendingIntent.FLAG_IMMUTABLE,
        )

        val stopIntent = Intent(this, RecordingService::class.java).apply {
            action = ACTION_STOP
            putExtra(EXTRA_STOP_REASON, SessionState.STOP_REASON_NOTIFICATION)
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            0,
            stopIntent,
            PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, NOTIF_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle(getString(R.string.snore_notification_title))
            .setContentText(getString(R.string.snore_notification_text))
            .setOngoing(true)
            .setContentIntent(contentPendingIntent)
            .addAction(0, getString(R.string.snore_notification_stop_action), stopPendingIntent)
            .build()
    }

    /**
     * Defensive-only: the foreground service type used here (`microphone`)
     * is not one of the time-limited types (`dataSync`/`mediaProcessing`/
     * `shortService`) that the platform is documented to enforce timeouts
     * against, so this is not expected to fire in practice. Overriding it
     * anyway means that if a future platform version ever does apply a
     * timeout here, the session still ends cleanly through [finalize]
     * instead of being killed out from under [SessionStore] with a stale
     * 'recording' row (which would then rely solely on the liveness check
     * to notice). Runs on the main thread (the platform calls it directly),
     * so it hops onto [workerHandler] rather than touching recorder state itself.
     */
    override fun onTimeout(startId: Int) {
        workerHandler.post { finalizeIfRecording(SessionState.STOP_REASON_ERROR, interrupted = true) }
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        workerHandler.post { finalizeIfRecording(SessionState.STOP_REASON_ERROR, interrupted = true) }
    }

    override fun onDestroy() {
        try {
            // Sanity net: if the service is being torn down through any path
            // that didn't already go through finalize() (e.g. the system
            // killing it directly), still try to persist real segment
            // durations while the process is alive to do so. onDestroy runs
            // on the main thread, but all the mutable recorder state this
            // touches is confined to workerThread, so this posts there and
            // blocks briefly (bounded, well under the ANR watchdog) waiting
            // for it — the alternative, mutating that state directly from
            // the main thread, would race with anything workerThread might
            // still be mid-way through. If the process is killed hard enough
            // that onDestroy never runs at all, SessionStore.getStatus()'s
            // liveness check (isRunning == false) is the fallback that
            // recovers the session as stopped/interrupted.
            val latch = CountDownLatch(1)
            workerHandler.post {
                try {
                    finalizeIfRecording(SessionState.STOP_REASON_ERROR, interrupted = true)
                } finally {
                    latch.countDown()
                }
            }
            latch.await(ON_DESTROY_FINALIZE_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        } finally {
            isRunning = false
            workerThread.quitSafely()
            super.onDestroy()
        }
    }

    companion object {
        const val ACTION_START = "app.unsmoke.snore.action.START"
        const val ACTION_STOP = "app.unsmoke.snore.action.STOP"
        const val EXTRA_SESSION_ID = "sessionId"
        const val EXTRA_STOP_REASON = "stopReason"

        const val NOTIF_CHANNEL_ID = "snore_monitor"
        private const val NOTIF_ID = 1

        private const val SEGMENT_MAX_DURATION_MS = 20 * 60 * 1000
        private const val MIN_FREE_BYTES = 500L * 1024 * 1024
        private const val AUDIO_SAMPLING_RATE = 16000
        private const val AUDIO_ENCODING_BIT_RATE = 32000
        private const val MAX_WAKE_LOCK_DURATION_MS = 12 * 60 * 60 * 1000L
        private const val ROTATION_WATCHDOG_MS = 8_000L
        private const val ON_DESTROY_FINALIZE_TIMEOUT_MS = 2_000L

        /**
         * Set `true` in [onCreate], `false` in [onDestroy]. [SessionStore]
         * reads this (via [SessionStateCodec.checkLiveness]) to detect a
         * session whose process died mid-recording.
         */
        @Volatile
        @JvmStatic
        var isRunning: Boolean = false
            private set
    }
}
