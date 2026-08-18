package app.unsmoke.snore

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.util.Log
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** One finalized audio segment to decode, in playback order. `fileName` is relative to the session directory. */
data class SegmentInfo(val fileName: String)

/**
 * Thrown when a segment's decoded audio doesn't match the fixed
 * [FeatureMath.SAMPLE_RATE_HZ] this recorder always captures at. Distinct
 * from a generic per-segment decode failure (see [FeatureExtractor.extract]
 * doc): a wrong sample rate means the whole extraction is untrustworthy (the
 * frame hop size and every band boundary are all defined in terms of that
 * fixed rate), not just this one segment, so it propagates out of
 * [FeatureExtractor.extract] rather than being swallowed — the plugin maps
 * it to the `EXTRACTION_FAILED` error code. Resampling instead was
 * considered and rejected: silently reinterpreting samples at the wrong
 * rate would produce features that are wrong in a way nothing downstream
 * could detect.
 */
class UnsupportedSampleRateException(message: String) : IOException(message)

/**
 * Streaming AAC-to-`features.bin` extractor: decodes each finalized segment
 * of a recording session, in order, through [MediaExtractor] + [MediaCodec],
 * and feeds the resulting 16-bit PCM into [FeatureMath.computeFrame] one
 * [FeatureMath.FRAME_SIZE]-sample hop at a time via [FeaturesFileWriter].
 *
 * O(1) memory in the recording's length: at any moment this holds at most
 * one codec output buffer's worth of PCM, one hop-sized carry buffer (see
 * [FrameAccumulator]), and one in-flight frame — never the whole night's
 * audio. The carry buffer is a single instance shared across the entire
 * segment list (constructed once in [extract], threaded through every
 * per-segment decode call), so a hop's samples can straddle not just two
 * codec output buffers within one segment but also a segment boundary:
 * segment rotation happens mid-stream (see `RecordingService`'s 20-minute
 * rotation), so the night is one continuous, gapless PCM stream from this
 * extractor's point of view, not N independent clips.
 */
object FeatureExtractor {

    private const val TAG = "FeatureExtractor"
    private const val DEQUEUE_TIMEOUT_US = 10_000L

    /**
     * Decodes [segments] (in order, relative to [sessionDir]) and streams
     * their features into [outFile], returning the number of frames
     * actually written (the authoritative count patched into the file's
     * header — see [FeaturesFileWriter.finish]).
     *
     * If a segment's own decode fails outright (corrupt/truncated file —
     * expected for an overnight recording's still-partially-written final
     * segment if the app or device died mid-recording), that is caught
     * here: extraction stops at that point, keeping every frame already
     * written from earlier segments, and only the segment's index and the
     * frame count so far are logged (never any audio content). A sample
     * rate mismatch ([UnsupportedSampleRateException]) is different: it is
     * NOT caught here and propagates to the caller, since it means the
     * whole extraction — not just this segment — is untrustworthy.
     */
    fun extract(sessionDir: File, segments: List<SegmentInfo>, outFile: File, startedAtEpochMs: Long): Int {
        val writer = FeaturesFileWriter(
            outFile,
            sampleRate = FeatureMath.SAMPLE_RATE_HZ,
            hopSamples = FeatureMath.FRAME_SIZE,
            startedAtEpochMs = startedAtEpochMs,
        )
        val accumulator = FrameAccumulator(FeatureMath.FRAME_SIZE)
        var frameCount = 0
        var fatal: Exception? = null
        try {
            for ((index, segment) in segments.withIndex()) {
                val segmentFile = File(sessionDir, segment.fileName)
                try {
                    frameCount += extractSegment(segmentFile, accumulator) { frame ->
                        writer.writeFrame(frame)
                    }
                } catch (e: UnsupportedSampleRateException) {
                    fatal = e
                    break
                } catch (e: Exception) {
                    Log.w(
                        TAG,
                        "segment $index of ${segments.size} failed to decode after $frameCount frames extracted; stopping extraction (${e.javaClass.simpleName})",
                    )
                    break
                }
            }
        } finally {
            writer.finish(frameCount)
        }
        fatal?.let { throw it }
        return frameCount
    }

    /**
     * Decodes one segment file, returning the number of hops (frames)
     * completed from it. [accumulator] is shared across the whole session
     * (see the class doc) so a partial hop at this segment's end carries
     * over into the next segment's decode.
     */
    private fun extractSegment(file: File, accumulator: FrameAccumulator, onFrame: (FloatArray) -> Unit): Int {
        var framesWritten = 0
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(file.absolutePath)

            var trackIndex = -1
            var format: MediaFormat? = null
            for (i in 0 until extractor.trackCount) {
                val candidate = extractor.getTrackFormat(i)
                val mime = candidate.getString(MediaFormat.KEY_MIME)
                if (mime != null && mime.startsWith("audio/")) {
                    trackIndex = i
                    format = candidate
                    break
                }
            }
            if (trackIndex < 0 || format == null) {
                throw IOException("no audio track found")
            }
            extractor.selectTrack(trackIndex)

            var channelCount = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            var sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            requireExpectedSampleRate(sampleRate)

            val mime = format.getString(MediaFormat.KEY_MIME)!!
            val codec = MediaCodec.createDecoderByType(mime)
            try {
                codec.configure(format, null, null, 0)
                codec.start()

                val bufferInfo = MediaCodec.BufferInfo()
                var sawInputEos = false
                var sawOutputEos = false

                while (!sawOutputEos) {
                    if (!sawInputEos) {
                        val inputIndex = codec.dequeueInputBuffer(DEQUEUE_TIMEOUT_US)
                        if (inputIndex >= 0) {
                            val inputBuffer = codec.getInputBuffer(inputIndex)
                                ?: throw IOException("codec returned no input buffer")
                            val sampleSize = extractor.readSampleData(inputBuffer, 0)
                            if (sampleSize < 0) {
                                codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                sawInputEos = true
                            } else {
                                codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
                                extractor.advance()
                            }
                        }
                    }

                    val outputIndex = codec.dequeueOutputBuffer(bufferInfo, DEQUEUE_TIMEOUT_US)
                    when {
                        outputIndex >= 0 -> {
                            if (bufferInfo.size > 0) {
                                val outputBuffer = codec.getOutputBuffer(outputIndex)
                                    ?: throw IOException("codec returned no output buffer")
                                outputBuffer.position(bufferInfo.offset)
                                outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
                                val mono = pcm16ToMonoShorts(outputBuffer, channelCount)
                                accumulator.push(mono) { hop ->
                                    onFrame(FeatureMath.computeFrame(hop))
                                    framesWritten++
                                }
                            }
                            codec.releaseOutputBuffer(outputIndex, false)
                            if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
                                sawOutputEos = true
                            }
                        }
                        outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                            val newFormat = codec.outputFormat
                            channelCount = newFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                            sampleRate = newFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                            requireExpectedSampleRate(sampleRate)
                        }
                        // INFO_TRY_AGAIN_LATER / the deprecated INFO_OUTPUT_BUFFERS_CHANGED: no-op, loop again.
                    }
                }
            } finally {
                codec.stop()
                codec.release()
            }
        } finally {
            extractor.release()
        }
        return framesWritten
    }

    private fun requireExpectedSampleRate(sampleRate: Int) {
        if (sampleRate != FeatureMath.SAMPLE_RATE_HZ) {
            throw UnsupportedSampleRateException(
                "expected ${FeatureMath.SAMPLE_RATE_HZ}Hz, segment reports ${sampleRate}Hz",
            )
        }
    }

    /**
     * Converts one codec output buffer of 16-bit PCM into mono shorts. The
     * recorder always configures mono capture (`RecordingService`), so
     * [channelCount] > 1 is only ever a defensive path — averaged down to
     * mono rather than e.g. taking a single channel, so no channel's audio
     * is silently discarded.
     */
    private fun pcm16ToMonoShorts(buffer: ByteBuffer, channelCount: Int): ShortArray {
        buffer.order(ByteOrder.LITTLE_ENDIAN) // MediaCodec PCM16 output is always little-endian.
        val shortBuffer = buffer.asShortBuffer()
        val totalShorts = shortBuffer.remaining()
        if (channelCount <= 1) {
            val out = ShortArray(totalShorts)
            shortBuffer.get(out)
            return out
        }
        val frameCount = totalShorts / channelCount
        val interleaved = ShortArray(totalShorts)
        shortBuffer.get(interleaved)
        val mono = ShortArray(frameCount)
        for (i in 0 until frameCount) {
            var sum = 0
            for (c in 0 until channelCount) {
                sum += interleaved[i * channelCount + c]
            }
            mono[i] = (sum / channelCount).toShort()
        }
        return mono
    }
}

/**
 * Accumulates arbitrary-length mono PCM pushes into fixed-size
 * [hopSamples]-sample hops, invoking a callback for each completed hop and
 * carrying any remainder forward — across codec output buffers and, since
 * one instance is reused for a whole session (see [FeatureExtractor]),
 * across segment boundaries too. Reuses a single internal buffer (no
 * per-hop allocation) to keep this O(1) memory.
 */
class FrameAccumulator(private val hopSamples: Int) {
    private val buffer = ShortArray(hopSamples)
    private var filled = 0

    fun push(samples: ShortArray, onHop: (ShortArray) -> Unit) {
        var pos = 0
        var remaining = samples.size
        while (remaining > 0) {
            val take = minOf(hopSamples - filled, remaining)
            System.arraycopy(samples, pos, buffer, filled, take)
            filled += take
            pos += take
            remaining -= take
            if (filled == hopSamples) {
                onHop(buffer)
                filled = 0
            }
        }
    }
}
