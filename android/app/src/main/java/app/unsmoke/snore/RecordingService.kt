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
import android.os.IBinder
import android.os.PowerManager
import android.os.StatFs
import androidx.core.app.NotificationCompat
import app.unsmoke.MainActivity
import app.unsmoke.R
import java.io.File
import java.io.IOException

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
 */
class RecordingService : Service() {

    private lateinit var sessionStore: SessionStore
    private var recorder: MediaRecorder? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var sessionDir: File? = null

    /** Index of the segment file currently receiving audio. */
    private var activeSegmentIndex = 0

    /** Index of the segment file queued via `setNextOutputFile`, if any. */
    private var queuedSegmentIndex: Int? = null

    /** Guards [finalize] so every stop path (intent/error/low-storage/timeout/onDestroy) only runs once. */
    private var finalizing = false

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        sessionStore = SessionStore(applicationContext)
        createNotificationChannel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                // Per the foreground-service contract, this must be the very
                // first thing done in onStartCommand — before any guard
                // checks, storage checks, or recorder setup.
                startForeground(
                    NOTIF_ID,
                    buildNotification(),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
                )
                handleStart(intent)
            }
            ACTION_STOP -> {
                val reason = intent.getStringExtra(EXTRA_STOP_REASON) ?: SessionState.STOP_REASON_USER
                finalize(reason, interrupted = false)
            }
            else -> {
                // Unknown/missing action with no active recorder: nothing to do.
                if (recorder == null) stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun handleStart(intent: Intent) {
        if (recorder != null) {
            // Already actively recording — a second ACTION_START (e.g. a
            // duplicate plugin call) is a no-op; the foreground
            // notification/state established above is all that's needed.
            return
        }

        val sessionId = intent.getStringExtra(EXTRA_SESSION_ID)
        if (sessionId.isNullOrBlank()) {
            finalize(SessionState.STOP_REASON_ERROR, interrupted = true)
            return
        }

        if (!hasEnoughStorage()) {
            finalize(SessionState.STOP_REASON_LOW_STORAGE, interrupted = true)
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
                    MediaRecorder.MEDIA_RECORDER_INFO_NEXT_OUTPUT_FILE_STARTED -> onSegmentRotated()
                    // MEDIA_RECORDER_INFO_MAX_DURATION_REACHED itself needs no
                    // action: the next file was already queued via
                    // setNextOutputFile ahead of time (right after start, and
                    // again after each rotation below), which is what lets
                    // MediaRecorder switch to it automatically at this
                    // boundary.
                }
            }
            newRecorder.setOnErrorListener { _, _, _ -> finalize(SessionState.STOP_REASON_ERROR, interrupted = true) }
            newRecorder.prepare()
            newRecorder.start()
        } catch (e: IOException) {
            newRecorder.release()
            finalize(SessionState.STOP_REASON_ERROR, interrupted = true)
            return
        } catch (e: RuntimeException) {
            newRecorder.release()
            finalize(SessionState.STOP_REASON_ERROR, interrupted = true)
            return
        }
        recorder = newRecorder
        queueNextSegment()
    }

    /** Called right after `start()` and again after each rotation, so the next file is always ready before the next boundary. */
    private fun queueNextSegment() {
        val current = recorder ?: return
        if (!hasEnoughStorage()) {
            finalize(SessionState.STOP_REASON_LOW_STORAGE, interrupted = true)
            return
        }
        val nextIndex = activeSegmentIndex + 1
        try {
            current.setNextOutputFile(segmentFile(nextIndex))
            queuedSegmentIndex = nextIndex
        } catch (e: IOException) {
            finalize(SessionState.STOP_REASON_ERROR, interrupted = true)
        } catch (e: IllegalStateException) {
            finalize(SessionState.STOP_REASON_ERROR, interrupted = true)
        }
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
    }

    /**
     * Every stop path converges here: recorder stop/release, measuring the
     * final (still-open) segment, persisting the 'stopped' state, releasing
     * the wake lock, and tearing down the foreground service. Guarded by
     * [finalizing] so it only ever runs once per session no matter how many
     * of ACTION_STOP / the error listener / the low-storage guard /
     * [onTimeout] / [onDestroy] fire.
     */
    private fun finalize(stopReason: String, interrupted: Boolean) {
        if (finalizing) return
        finalizing = true

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
     * to notice).
     */
    override fun onTimeout(startId: Int) {
        finalize(SessionState.STOP_REASON_ERROR, interrupted = true)
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        finalize(SessionState.STOP_REASON_ERROR, interrupted = true)
    }

    override fun onDestroy() {
        try {
            // Sanity net: if the service is being torn down through any path
            // that didn't already go through finalize() (e.g. the system
            // killing it directly), still try to persist real segment
            // durations while the process is alive to do so. If the process
            // is killed hard enough that onDestroy never runs at all,
            // SessionStore.getStatus()'s liveness check (isRunning == false)
            // is the fallback that recovers the session as stopped/interrupted.
            finalize(SessionState.STOP_REASON_ERROR, interrupted = true)
        } finally {
            isRunning = false
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
