/**
 * Snore-detection thresholds. Every value here is a SPEC value from the
 * detection design, not a tuning knob picked by this implementation — treat
 * changes to these numbers as changes to the algorithm's behavior contract.
 */

/** Bumped whenever the detection algorithm changes in a way that would alter results for the same frames. */
export const ANALYSIS_VERSION = 'ts-1.0.0';

/** Trailing window (ms) the adaptive noise floor is computed over. */
export const NOISE_FLOOR_WINDOW_MS = 60_000;

/** Percentile (0..1) of rmsDbfs within the trailing window used as the noise floor. */
export const NOISE_FLOOR_PERCENTILE = 0.2;

/** A frame must exceed the noise floor by this many dB to be a snore candidate. */
export const CANDIDATE_DELTA_DB = 8;

/** Minimum share of energy in the 70-300 Hz band (snore fundamental) for a candidate frame. */
export const MIN_LOW_BAND_RATIO = 0.5;

/** Maximum share of energy in the 800-3000 Hz band (speech/TV) for a candidate frame. */
export const MAX_MID_BAND_RATIO = 0.35;

/** Gaps between candidate frames up to this long (ms) are bridged into one burst. */
export const BURST_GAP_TOLERANCE_MS = 200;

/** Bursts shorter than this (ms) are discarded as noise spikes. */
export const MIN_BURST_MS = 300;

/** Bursts longer than this (ms) are discarded — too long to be a single snore. */
export const MAX_BURST_MS = 5_000;

/** A rhythmic run must contain at least this many consecutive qualifying bursts. */
export const MIN_RUN_BURSTS = 3;

/** Minimum onset-to-onset interval (ms) between bursts in a qualifying rhythmic run. */
export const MIN_BREATH_INTERVAL_MS = 2_000;

/** Maximum onset-to-onset interval (ms) between bursts in a qualifying rhythmic run. */
export const MAX_BREATH_INTERVAL_MS = 10_000;

/** Maximum coefficient of variation (stddev/mean) of onset intervals in a qualifying run. */
export const MAX_INTERVAL_CV = 0.5;

/** Qualifying bursts separated by gaps up to this long (ms) are merged into one SnoreEvent. */
export const EVENT_MERGE_GAP_MS = 10_000;

/** Events separated by gaps up to this long (ms) are merged into one "episode" for metrics (e.g. longestEpisodeMs). */
export const EPISODE_MERGE_GAP_MS = 60_000;

/** Events scoring below this confidence (0..1) are dropped entirely. */
export const MIN_EVENT_CONFIDENCE = 0.4;

/** A recording shorter than this (ms) is not considered analyzable (session -> 'failed'). */
export const MIN_ANALYZABLE_MS = 3_600_000;

/** Upper bound on native audio clips retained per night, even with keepSnoreClips enabled. */
export const MAX_CLIPS_PER_NIGHT = 10;

/** Padding (ms) added before/after an event's span when the native layer extracts its audio clip. */
export const CLIP_PADDING_MS = 1_500;
