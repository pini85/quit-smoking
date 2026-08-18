'use client';

import { useMemo } from 'react';
import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
import { Card } from '@/components/ui/Card';
import { CravingDeclineSection } from '@/components/progress/CravingDeclineSection';
import { PassRateSection } from '@/components/progress/PassRateSection';
import { BeforeVsNowSection } from '@/components/progress/BeforeVsNowSection';
import { TriggersSection } from '@/components/progress/TriggersSection';
import { TimeOfDaySection } from '@/components/progress/TimeOfDaySection';
import { InsightsFeed } from '@/components/progress/InsightsFeed';
import { HistoryList } from '@/components/progress/HistoryList';
import { useMessages } from '@/lib/i18n';

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 pt-4" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="h-32 animate-pulse bg-surface-raised" />
      ))}
    </div>
  );
}

/**
 * Progress — the proof screen: a vertical feed of gated stats cards, each
 * one either showing what the user's real data says or an honest invitation
 * to log more (see `GatedCard`). Order is binding per the brief: craving
 * decline (hero), pass rate, before-vs-now, triggers, time of day, deterministic
 * insights, then the full craving history.
 *
 * `sessions` includes preQuit-logged cravings — the brief is explicit that
 * nothing is excluded here, unlike the quit-stats used elsewhere in the app.
 * Every section recomputes from `sessions`/`quitAt`/`now` in its own
 * `useMemo`; `now` is rounded to the minute (and re-memoized on that
 * rounded value) so a tick of the shared clock only invalidates once a
 * minute, not on every render.
 */
export default function ProgressPage() {
  const { data } = useAppData();
  const now = useNow(60000);
  const m = useMessages();

  const profile = data.profile;
  const quitAtMs = profile ? new Date(profile.quitAt).getTime() : null;
  const minuteKey = Math.floor(now.getTime() / 60_000);

  const quitAt = useMemo(() => (quitAtMs === null ? null : new Date(quitAtMs)), [quitAtMs]);
  const nowMinute = useMemo(() => new Date(minuteKey * 60_000), [minuteKey]);
  const sessions = data.cravings;

  if (data.status !== 'ready' || profile === null || quitAt === null) {
    return <Skeleton />;
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-[24px] font-semibold tracking-tight text-ink">{m.progress.pageTitle}</h1>

      <CravingDeclineSection sessions={sessions} quitAt={quitAt} now={nowMinute} />
      <PassRateSection sessions={sessions} now={nowMinute} />
      <BeforeVsNowSection sessions={sessions} quitAt={quitAt} now={nowMinute} />
      <TriggersSection sessions={sessions} />
      <TimeOfDaySection sessions={sessions} />
      <InsightsFeed sessions={sessions} quitAt={quitAt} now={nowMinute} />
      <HistoryList sessions={sessions} now={nowMinute} />
    </div>
  );
}
