'use client';

import { useEffect, useState } from 'react';

import { getSleepRecorder } from '@/lib/recorder';
import type { RecorderAvailability, SleepRecorder } from '@/lib/recorder/types';

export interface UseSleepRecorderResult {
  recorder: SleepRecorder | null;
  availability: RecorderAvailability;
  /** True once resolution has completed (native/web-dev/unavailable all set `ready`). */
  ready: boolean;
}

const INITIAL_STATE: UseSleepRecorderResult = {
  recorder: null,
  availability: 'unavailable',
  ready: false,
};

/**
 * Resolves the platform's `SleepRecorder` once on mount — the native
 * adapter on Android, the dev-only web adapter in a browser during
 * development, or none at all otherwise (including production web and
 * prerender, where `ready` stays false and `availability` stays
 * 'unavailable' until the real answer comes back).
 *
 * `getSleepRecorder()` is async (it dynamically imports whichever adapter
 * applies), so this is a plain resolve-then-setState effect — mirrors the
 * shape used elsewhere in this codebase for one-shot async resolution.
 */
export function useSleepRecorder(): UseSleepRecorderResult {
  const [state, setState] = useState<UseSleepRecorderResult>(INITIAL_STATE);

  useEffect(() => {
    let cancelled = false;
    void getSleepRecorder().then(({ recorder, availability }) => {
      if (cancelled) return;
      setState({ recorder, availability, ready: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export default useSleepRecorder;
