'use client';

import { useEffect, useMemo, useState } from 'react';
import { computeSnoreTrends } from '@/domain/snore/trends';
import { useAppData } from '@/lib/hooks/useAppData';
import { useSleepRecorder } from '@/lib/hooks/useSleepRecorder';
import { useNow } from '@/lib/hooks/useNow';
import { onAppResume } from '@/lib/native/platform';
import type { RecorderStatus } from '@/lib/recorder/types';
import { useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { deriveView } from './deriveView';
import { buildSleepSessionService } from './sleepService';
import { PreSleepCard } from './PreSleepCard';
import { ActiveMonitoringCard } from './ActiveMonitoringCard';
import { AnalyzingCard } from './AnalyzingCard';
import { MorningResults } from './MorningResults';
import { ClipsList } from './ClipsList';
import { SleepTrendSection } from './SleepTrendSection';
import { SleepHistoryList } from './SleepHistoryList';

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 pt-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="h-32 animate-pulse bg-surface-raised" />
      ))}
    </div>
  );
}

function LoadingHero() {
  return (
    <div aria-hidden="true">
      <Card className="h-40 animate-pulse bg-surface-raised" />
    </div>
  );
}

/**
 * /sleep — a single state-machine hero (pre-sleep tips, active monitoring,
 * analyzing/retry, or last night's results) plus the always-on trend and
 * history sections below it, which keep showing real data (e.g. imported
 * from another device) even when this device/browser can't record at all.
 */
export function SleepScreen() {
  const { data, store } = useAppData();
  const { recorder, availability, ready } = useSleepRecorder();
  const now = useNow(60_000);
  const m = useMessages();

  const [nativeStatus, setNativeStatus] = useState<RecorderStatus | null>(null);

  // Native status is read at mount AND on every native resume. The resume
  // leg is what keeps a natively-ended session (the notification's Stop
  // action, an error, low storage) from being rendered as still live while
  // this screen sat in the background: without it the hero would stay stuck
  // on `ActiveMonitoringCard` for a recording that no longer exists. Mirrors
  // `SleepRecovery`'s own mount + `onAppResume` pairing, which is what
  // actually finalizes/analyzes such a session.
  useEffect(() => {
    if (!ready || recorder === null) return;
    let cancelled = false;
    const read = () => {
      void recorder
        .getStatus()
        .then((status) => {
          if (!cancelled) setNativeStatus(status);
        })
        .catch((error: unknown) => {
          console.error('Unsmoke: failed to read the native recorder status', error);
        });
    };
    read();
    const unsubscribe = onAppResume(read);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [ready, recorder]);

  const service = useMemo(
    () => (recorder ? buildSleepSessionService(recorder, store) : null),
    [recorder, store]
  );

  const profile = data.profile;
  const quitAtMs = profile ? new Date(profile.quitAt).getTime() : null;
  const sessions = data.sleepSessions;

  const quitAt = useMemo(() => (quitAtMs === null ? null : new Date(quitAtMs)), [quitAtMs]);
  const trends = useMemo(
    () => (quitAt ? computeSnoreTrends(sessions, quitAt, now) : null),
    [sessions, quitAt, now]
  );

  if (data.status !== 'ready' || profile === null || quitAt === null || trends === null) {
    return <Skeleton />;
  }

  const view = deriveView(nativeStatus, sessions, now);
  const showUnavailable = ready && availability === 'unavailable';

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">{m.sleep.pageTitle}</h1>

      {showUnavailable ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">{m.sleep.unavailable.title}</h2>
          <EmptyState>{m.sleep.unavailable.body}</EmptyState>
        </div>
      ) : !ready || recorder === null || service === null || view.phase === 'loading' ? (
        <LoadingHero />
      ) : view.phase === 'pre-sleep' ? (
        <PreSleepCard
          recorder={recorder}
          service={service}
          store={store}
          preferences={data.preferences}
          sessions={sessions}
          availability={availability}
          onStarted={(status) => setNativeStatus(status)}
        />
      ) : view.phase === 'active' ? (
        <ActiveMonitoringCard
          service={service}
          startedAtMs={view.startedAtMs}
          availability={availability}
          onStopped={() => setNativeStatus((s) => (s ? { phase: 'idle' } : s))}
        />
      ) : view.phase === 'analyzing' ? (
        <AnalyzingCard service={service} store={store} session={view.session} />
      ) : (
        <>
          <MorningResults session={view.session} trends={trends} />
          {data.preferences?.keepSnoreClips === true &&
          view.session.events?.some((e) => e.clipPath !== undefined) ? (
            <ClipsList recorder={recorder} store={store} session={view.session} />
          ) : null}
        </>
      )}

      <SleepTrendSection trends={trends} />
      <SleepHistoryList sessions={sessions} service={service} store={store} />
    </div>
  );
}

export default SleepScreen;
