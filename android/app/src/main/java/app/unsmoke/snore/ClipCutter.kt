package app.unsmoke.snore

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer

/**
 * Cuts one [ClipSlice] (produced by [ClipMapper.mapRange]) out of its
 * containing segment file into a brand-new, independently playable `.m4a`
 * file — a stream copy (no decode/re-encode) via [MediaExtractor] +
 * [MediaMuxer], analogous to [FeatureExtractor] but for clip export rather
 * than feature decoding: that class always decodes full PCM through
 * `MediaCodec`; this one never touches sample bytes, it only re-packages
 * existing encoded access units into a new container.
 *
 * Not unit-testable on the plain JVM (unlike [ClipMapper]) — every type here
 * is a thin wrapper around real Android media codecs/muxers with no local
 * JVM stand-in, the same reason [FeatureExtractor] itself has no JVM test
 * (see `FeatureExtractorSegmentLoopTest`, which tests only the pure loop
 * factored out of it).
 */
object ClipCutter {

    /** Generous default read buffer if the segment's format doesn't advertise KEY_MAX_INPUT_SIZE (AAC access units are small). */
    private const val DEFAULT_BUFFER_SIZE = 1 shl 20 // 1 MiB

    /**
     * Cuts [slice] out of its segment file (resolved via
     * [RecordingService.segmentFileName] against [sessionDir]) into
     * [outFile], an MPEG-4 container holding just that slice's audio track.
     *
     * Selects the segment's (sole) audio track, seeks to the previous sync
     * sample at-or-before `slice.offsetInSegmentMs`, then copies every
     * sample up to (not including) the slice's end straight through
     * [MediaMuxer] — no decode, so timing/quality are unchanged — with
     * presentation timestamps rebased so the FIRST copied sample lands at
     * time 0 in [outFile] (a copy starting mid-file must not carry the
     * source segment's own multi-minute offset into the clip).
     *
     * Every extractor/muxer resource is released in `finally` regardless of
     * outcome. On any failure (no audio track, muxer error, mid-copy
     * exception), the partially-written [outFile] is deleted before the
     * exception propagates — callers must never be handed a corrupt/partial
     * clip file.
     */
    fun cut(sessionDir: File, slice: ClipSlice, outFile: File) {
        val segmentFile = File(sessionDir, RecordingService.segmentFileName(slice.segmentIndex))
        val extractor = MediaExtractor()
        var muxer: MediaMuxer? = null
        try {
            extractor.setDataSource(segmentFile.absolutePath)

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
                throw IOException("no audio track found in segment")
            }
            extractor.selectTrack(trackIndex)

            val offsetUs = slice.offsetInSegmentMs * 1_000L
            val endUs = offsetUs + slice.durationMs * 1_000L
            extractor.seekTo(offsetUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)

            val newMuxer = MediaMuxer(outFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            muxer = newMuxer
            val muxerTrackIndex = newMuxer.addTrack(format)
            newMuxer.start()

            val bufferSize = if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
                format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)
            } else {
                DEFAULT_BUFFER_SIZE
            }
            val buffer = ByteBuffer.allocate(bufferSize)
            val bufferInfo = MediaCodec.BufferInfo()
            var baseTimeUs = -1L

            while (true) {
                buffer.clear()
                val sampleSize = extractor.readSampleData(buffer, 0)
                if (sampleSize < 0) break // end of stream
                val sampleTimeUs = extractor.sampleTime
                if (sampleTimeUs >= endUs) break // reached the slice's end
                if (baseTimeUs < 0) baseTimeUs = sampleTimeUs

                bufferInfo.offset = 0
                bufferInfo.size = sampleSize
                bufferInfo.presentationTimeUs = sampleTimeUs - baseTimeUs
                bufferInfo.flags = extractor.sampleFlags
                newMuxer.writeSampleData(muxerTrackIndex, buffer, bufferInfo)
                extractor.advance()
            }

            newMuxer.stop()
        } catch (e: Exception) {
            outFile.delete()
            throw e
        } finally {
            extractor.release()
            muxer?.release()
        }
    }
}
