'use client';

import { useMemo, useState } from 'react';
import type { Belief } from '@/domain/types';
import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
import { Card } from '@/components/ui/Card';
import { BoosterCard } from '@/components/freedom/BoosterCard';
import { BeliefMap } from '@/components/freedom/BeliefMap';
import { ProofSection } from '@/components/freedom/ProofSection';
import { ExerciseSheet } from '@/components/freedom/ExerciseSheet';
import { useMessages } from '@/lib/i18n';

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 pt-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="h-32 animate-pulse bg-surface-raised" />
      ))}
    </div>
  );
}

/**
 * Freedom — the "why does a cigarette still look appealing?" screen. Order is
 * binding per the brief: today's booster (a short read, dismissable), then the
 * belief map (every promise, filed by where it stands, tappable into its
 * exercise), then the user's own logged evidence where there is enough of it.
 *
 * Unlike Progress, nothing here needs a resolved quit moment — the beliefs and
 * lessons stand on their own — so the only gate is the store being ready.
 * `now` is rounded to the minute (the shape `app/progress/page.tsx` uses) and
 * only ever feeds the booster's day-key rotation.
 */
export default function FreedomPage() {
  const { data, store } = useAppData();
  const m = useMessages();
  const now = useNow(60000);
  const [openBelief, setOpenBelief] = useState<Belief | null>(null);

  const minuteKey = Math.floor(now.getTime() / 60_000);
  const nowMinute = useMemo(() => new Date(minuteKey * 60_000), [minuteKey]);

  if (data.status !== 'ready') {
    return <Skeleton />;
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">{m.freedom.pageTitle}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          {m.freedom.pageSubtitle}
        </p>
      </div>

      <BoosterCard
        assessments={data.beliefAssessments}
        cravings={data.cravings}
        now={nowMinute}
      />

      <BeliefMap assessments={data.beliefAssessments} onOpenBelief={setOpenBelief} />

      <ProofSection sessions={data.cravings} />

      <ExerciseSheet
        beliefId={openBelief}
        assessments={data.beliefAssessments}
        cravings={data.cravings}
        store={store}
        onClose={() => setOpenBelief(null)}
      />
    </div>
  );
}
