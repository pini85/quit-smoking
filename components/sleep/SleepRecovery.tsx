'use client';

import { useEffect, useRef } from 'react';
import { useAppData } from '@/lib/hooks/useAppData';
import { useSleepRecorder } from '@/lib/hooks/useSleepRecorder';
import { onAppResume } from '@/lib/native/platform';
import { buildSleepSessionService } from './sleepService';

/**
 * The safety net for sleep sessions across a restart or a background/resume
 * cycle. Mounted once in `AppShell`, renders nothing.
 *
 * Runs `SleepSessionService.recoverOnLaunch` exactly once, as soon as both
 * app data and the platform recorder (native or the dev-only web adapter)
 * are ready, then re-runs the SAME call every time the native app resumes
 * from background — both are safe to repeat and no-op instantly when
 * nothing is pending (see the service's own doc for why).
 */
export function SleepRecovery() {
  const { data, store } = useAppData();
  const { recorder, ready } = useSleepRecorder();
  const ranInitialRecovery = useRef(false);

  const canRecover = data.status === 'ready' && ready && recorder !== null;

  useEffect(() => {
    if (!canRecover || recorder === null || ranInitialRecovery.current) return;
    ranInitialRecovery.current = true;

    const service = buildSleepSessionService(recorder, store);
    service.recoverOnLaunch(new Date()).catch((error: unknown) => {
      console.error('Unsmoke: failed to recover sleep sessions on launch', error);
    });
  }, [canRecover, recorder, store]);

  useEffect(() => {
    if (!canRecover || recorder === null) return;

    const service = buildSleepSessionService(recorder, store);
    return onAppResume(() => {
      service.recoverOnLaunch(new Date()).catch((error: unknown) => {
        console.error('Unsmoke: failed to re-sync sleep sessions on resume', error);
      });
    });
  }, [canRecover, recorder, store]);

  return null;
}

export default SleepRecovery;
