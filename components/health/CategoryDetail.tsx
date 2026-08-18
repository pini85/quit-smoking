'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { HealthMilestone, MilestoneCategory } from '@/domain/types';
import { HEALTH_MILESTONES } from '@/data/healthMilestones';
import { computeMilestoneStates, type MilestoneState } from '@/domain/milestones/engine';
import { useAppData } from '@/lib/hooks/useAppData';
import { useNow } from '@/lib/hooks/useNow';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MilestoneSheet } from './MilestoneSheet';
import { FullMilestoneCard } from './MilestoneCard';
import { CATEGORY_META } from './categoryMeta';
import { useMessages } from '@/lib/i18n';

function earliestHoursOf(m: HealthMilestone): number {
  return m.timing.kind === 'noTimeline' ? Infinity : m.timing.earliestHours;
}

/** happening-now first, then upcoming (soonest first), then achieved, then noTimeline last. */
function sortForCategoryDetail(states: MilestoneState[]): {
  dated: MilestoneState[];
  noTimeline: MilestoneState[];
} {
  const happeningNow = states.filter((s) => s.status === 'happening-now');
  const upcoming = states
    .filter((s) => s.status === 'upcoming')
    .sort((a, b) => earliestHoursOf(a.milestone) - earliestHoursOf(b.milestone));
  const achieved = states.filter((s) => s.status === 'achieved');
  const noTimeline = states.filter((s) => s.status === 'no-timeline');

  return { dated: [...happeningNow, ...upcoming, ...achieved], noTimeline };
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 pt-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="h-32 animate-pulse bg-surface-raised" />
      ))}
    </div>
  );
}

function BackLink() {
  const m = useMessages();
  return (
    <Link
      href="/health"
      className="inline-flex min-h-11 w-fit items-center text-[14px] font-medium text-primary-strong"
    >
      {m.health.categoryDetail.back}
    </Link>
  );
}

/**
 * One category's full milestone list — the "you navigated here deliberately"
 * screen, so unlike the rest of the health tab it never hides emerging
 * evidence; it just always shows the caveat alongside it.
 */
export function CategoryDetail({ category }: { category: MilestoneCategory }) {
  const { data } = useAppData();
  const now = useNow(60000);
  const m = useMessages();
  const [sheetMilestone, setSheetMilestone] = useState<HealthMilestone | null>(null);

  const profile = data.profile;
  const quitAtMs = profile ? new Date(profile.quitAt).getTime() : null;
  const minuteKey = Math.floor(now.getTime() / 60_000);

  const categoryMilestones = useMemo(
    () => HEALTH_MILESTONES.filter((m) => m.category === category),
    [category]
  );

  const states = useMemo(() => {
    if (quitAtMs === null) return [];
    return computeMilestoneStates(
      categoryMilestones,
      new Date(quitAtMs),
      new Date(minuteKey * 60_000)
    );
  }, [categoryMilestones, quitAtMs, minuteKey]);

  const meta = CATEGORY_META[category];

  if (data.status !== 'ready' || profile === null || quitAtMs === null) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <BackLink />
        <Skeleton />
      </div>
    );
  }

  const quitAt = new Date(quitAtMs);
  const { dated, noTimeline } = sortForCategoryDetail(states);

  return (
    <>
      <div className="flex flex-col gap-4 pt-2">
        <BackLink />

        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-[28px] leading-none">
            {meta.emoji}
          </span>
          <h1 className="text-[24px] font-semibold tracking-tight text-ink">{meta.label}</h1>
        </div>

        {dated.length === 0 && noTimeline.length === 0 ? (
          <EmptyState>{m.health.categoryDetail.empty}</EmptyState>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {dated.map((state) => (
                <FullMilestoneCard
                  key={state.milestone.id}
                  state={state}
                  onOpen={() => setSheetMilestone(state.milestone)}
                  showEmergingCaveat
                />
              ))}
            </div>

            {noTimeline.length > 0 ? (
              <div className="flex flex-col gap-3">
                <h2 className="text-[13px] font-medium uppercase tracking-[0.06em] text-ink-faint">
                  {m.health.categoryDetail.alsoTrue}
                </h2>
                <div className="flex flex-col gap-3">
                  {noTimeline.map((state) => (
                    <FullMilestoneCard
                      key={state.milestone.id}
                      state={state}
                      onOpen={() => setSheetMilestone(state.milestone)}
                      showEmergingCaveat
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <MilestoneSheet
        milestone={sheetMilestone}
        onClose={() => setSheetMilestone(null)}
        quitAt={quitAt}
        now={now}
      />
    </>
  );
}

export default CategoryDetail;
