'use client';

import { useEffect, useRef } from 'react';
import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
import { sweepAchievements } from '@/lib/services/achievementSweep';

/**
 * Runs the achievement sweep on a minute tick, from anywhere in the app.
 *
 * Every other sweep call site is attached to a WRITE (a finished craving) or
 * to the achievements screen mounting — but most badges are purely
 * time-based ("24 hours", "one week"), so without this they would only
 * appear the next time the user happened to log something or open You. This
 * makes the unlock land while they are looking at the screen it is about.
 *
 * Renders nothing. Mounted once in `AppShell`, inside `AppDataProvider`.
 */
export function AchievementTicker() {
  const { data, store } = useAppData();
  const now = useNow(60000);
  // A sweep is a read + (rarely) a write + a refresh; a slow one must not
  // have a second one stacked on top of it by the next tick.
  const runningRef = useRef(false);

  const ready = data.status === 'ready' && data.profile !== null;
  const minuteKey = Math.floor(now.getTime() / 60_000);

  useEffect(() => {
    if (!ready || runningRef.current) return;
    runningRef.current = true;
    sweepAchievements(store)
      .catch((error: unknown) => {
        console.error('Unsmoke: achievement sweep failed', error);
      })
      .finally(() => {
        runningRef.current = false;
      });
    // `minuteKey` is the tick: re-running on each new minute is the point.
  }, [ready, minuteKey, store]);

  return null;
}

export default AchievementTicker;
