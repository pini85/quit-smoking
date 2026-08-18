'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SleepSession } from '@/domain/types';
import { hoursBetween } from '@/domain/time';
import { computeSnoreTrends } from '@/domain/snore/trends';
import { useAppData } from '@/lib/hooks/useAppData';
import { useSleepRecorder } from '@/lib/hooks/useSleepRecorder';
import { useNow } from '@/lib/hooks/useNow';
import type { RecorderStatus } from '@/lib/recorder/types';
import { useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
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
 * How long a finished night keeps the hero slot as `MorningResults` before
 * automatically reverting to `PreSleepCard`. Anchored to `endedAt` (falling
 * back to `startedAt` for a 'failed' row that never got one) rather than a
 * calendar-day boundary: a session that starts at 23:18 and ends at 07:00
 * has "yesterday's" `startedAt` but should still show its results all
 * morning, and a 00:30 session must not pin results in place until midnight
 * with no way to start tonight's recording. 12h comfortably covers "the
 * rest of the day this night ended on" for any normal sleep schedule.
 *
 * Auto-reverting (rather than also adding a Start affordance inside
 * `MorningResults`) is the deliberate choice here: the hero stays a strict
 * one-card state machine, Start only ever lives on `PreSleepCard`, and
 * last night's numbers remain visible regardless via `SleepHistoryList`/
 * `SleepTrendSection` below.
 */
const RESULTS_WINDOW_HOURS = 12;

function withinResultsWindow(session: SleepSession, now: Date): boolean {
  const anchor = new Date(session.endedAt ?? session.startedAt);
  return hoursBetween(anchor, now) < RESULTS_WINDOW_HOURS;
}

type SleepView =
  | { phase: 'loading' }
  | { phase: 'pre-sleep' }
  | { phase: 'active'; startedAtMs: number }
  | { phase: 'analyzing'; session: SleepSession }
  | { phase: 'results'; session: SleepSession };

/**
 * Derives which single hero card to show from native truth (`nativeStatus`,
 * refreshed at mount and after start/stop) plus the latest stored row —
 * never from recomputing recovery/adoption logic, which is entirely
 * `SleepRecovery`'s job elsewhere. See `RESULTS_WINDOW_HOURS` for how long a
 * finished night holds the 'results' slot before reverting to 'pre-sleep'.
 */
function deriveView(nativeStatus: RecorderStatus | null, sessions: SleepSession[], now: Date): SleepView {
  if (nativeStatus === null) return { phase: 'loading' };

  if (nativeStatus.phase === 'recording') {
    const session = sessions.find((s) => s.id === nativeStatus.sessionId);
    const startedAtMs =
      nativeStatus.startedAtMs ?? (session ? new Date(session.startedAt).getTime() : now.getTime());
    return { phase: 'active', startedAtMs };
  }

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  const latest = sorted[0];

  if (latest && (latest.state === 'recording' || latest.state === 'recorded')) {
    return { phase: 'analyzing', session: latest };
  }
  if (
    latest &&
    (latest.state === 'analyzed' || latest.state === 'failed') &&
    withinResultsWindow(latest, now)
  ) {
    return { phase: 'results', session: latest };
  }
  return { phase: 'pre-sleep' };
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

  useEffect(() => {
    if (!ready || recorder === null) return;
    let cancelled = false;
    void recorder.getStatus().then((status) => {
      if (!cancelled) setNativeStatus(status);
    });
    return () => {
      cancelled = true;
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
