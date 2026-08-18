'use client';

import type { HealthMilestone } from '@/domain/types';
import type { MilestoneState } from '@/domain/milestones/engine';
import { happeningNow, recentlyAchieved, upcomingSoon } from '@/domain/milestones/engine';
import { EmptyState } from '@/components/ui/EmptyState';
import { useMessages } from '@/lib/i18n';
import { filterEmerging } from './filterEmerging';
import { FullMilestoneCard } from './MilestoneCard';
import { CompactAchievedRow, CompactUpcomingCard } from './MilestoneRows';

export type RightNowViewProps = {
  states: MilestoneState[];
  showEmergingEvidence: boolean;
  preQuit: boolean;
  onOpenMilestone: (milestone: HealthMilestone) => void;
};

/**
 * "Right now" — what's actually changing in the body today, what's about to
 * start, and what just wrapped up. Pre-quit, every dated milestone is
 * mechanically 'upcoming' already (the engine handles that), so this view
 * just adds the explanatory banner rather than special-casing the lists.
 */
export function RightNowView({
  states,
  showEmergingEvidence,
  preQuit,
  onOpenMilestone,
}: RightNowViewProps) {
  const m = useMessages();
  const visible = filterEmerging(states, showEmergingEvidence);

  const now = happeningNow(visible);
  const soon = upcomingSoon(visible, 2);
  const done = recentlyAchieved(visible, 3);

  return (
    <div className="flex flex-col gap-6">
      {preQuit ? (
        <EmptyState icon="⏳">{m.health.rightNow.preQuitBanner}</EmptyState>
      ) : null}

      {now.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">
            {m.health.rightNow.happeningNow}
          </h2>
          <div className="flex flex-col gap-3">
            {now.map((state) => (
              <FullMilestoneCard
                key={state.milestone.id}
                state={state}
                onOpen={() => onOpenMilestone(state.milestone)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {soon.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">
            {m.health.rightNow.arrivingSoon}
          </h2>
          <div className="flex flex-col gap-2">
            {soon.map((state) => (
              <CompactUpcomingCard
                key={state.milestone.id}
                state={state}
                onOpen={() => onOpenMilestone(state.milestone)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {done.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">
            {m.health.rightNow.recentlyCompleted}
          </h2>
          <div className="flex flex-col gap-2">
            {done.map((state) => (
              <CompactAchievedRow
                key={state.milestone.id}
                state={state}
                onOpen={() => onOpenMilestone(state.milestone)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!preQuit && now.length === 0 && soon.length === 0 && done.length === 0 ? (
        <EmptyState>{m.health.rightNow.nothingYet}</EmptyState>
      ) : null}
    </div>
  );
}

export default RightNowView;
