/**
 * Resolves which `SleepRecorder` adapter (if any) this environment can use.
 * Both adapters touch browser-only globals (Capacitor plugins, getUserMedia,
 * AudioContext), so they are loaded via dynamic `import()` and only once we
 * already know we're on the client — this function itself never touches
 * `navigator`/`window` at module scope, so it stays safe under prerender.
 */
import { isNativeAndroid } from '@/lib/native/platform';
import type { RecorderAvailability, SleepRecorder } from '@/lib/recorder/types';

export type { RecorderAvailability, SleepRecorder } from '@/lib/recorder/types';

export async function getSleepRecorder(): Promise<{
  recorder: SleepRecorder | null;
  availability: RecorderAvailability;
}> {
  if (isNativeAndroid()) {
    const { nativeSleepRecorder } = await import('@/lib/recorder/nativeSleepRecorder');
    return { recorder: nativeSleepRecorder, availability: 'native' };
  }

  if (
    process.env.NODE_ENV !== 'production' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  ) {
    const { webSleepRecorder } = await import('@/lib/recorder/webSleepRecorder');
    return { recorder: webSleepRecorder, availability: 'web-dev' };
  }

  return { recorder: null, availability: 'unavailable' };
}
