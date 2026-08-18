'use client';

import type { HealthMilestone } from '@/domain/types';
import type { MilestoneState } from '@/domain/milestones/engine';
import { happeningNow, upcomingSoon } from '@/domain/milestones/engine';
import { Card } from '@/components/ui/Card';
import { useMessages } from '@/lib/i18n';
import { EvidenceBadge } from '@/components/ui/EvidenceBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CATEGORY_META } from '@/components/health/categoryMeta';
import { filterEmerging } from '@/components/health/filterEmerging';

export type BodyNowCarouselProps = {
  states: MilestoneState[];
  /** From `preferences.showEmergingEvidence`; emerging entries drop out when false. */
  showEmergingEvidence: boolean;
  onOpenMilestone: (milestone: HealthMilestone) => void;
};

function MilestoneNowCard({
  state,
  startingSoon,
  onOpen,
}: {
  state: MilestoneState;
  startingSoon: boolean;
  onOpen: () => void;
}) {
  const m = useMessages();
  const { milestone, progress } = state;
  const category = CATEGORY_META[milestone.category];

  return (
    // The width/snap live on a wrapper, not on the Card: Card's own `w-full`
    // and a `w-[85%]` override would be two utilities for the same property,
    // and which one wins depends on stylesheet order rather than class order.
    <div className="w-[85%] shrink-0 snap-center">
      <Card onClick={onOpen} className="flex h-full flex-col gap-3">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
          <span aria-hidden="true">{category.emoji}</span> {category.label}
        </p>

        <p className="text-[15px] font-semibold leading-snug text-ink">
          {milestone.title}
        </p>

        <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
          {milestone.description}
        </p>

        <EvidenceBadge level={milestone.evidenceLevel} className="self-start" />

        {startingSoon ? (
          <p className="text-[12px] text-ink-faint">{m.home.bodyNow.startingSoon}</p>
        ) : progress !== undefined ? (
          <ProgressBar value={progress} label={m.home.bodyNow.progressLabel} />
        ) : null}

        {milestone.honestNote ? (
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
            {milestone.honestNote}
          </p>
        ) : null}
      </Card>
    </div>
  );
}

/** Pre-quit stand-in for the carousel: nothing is changing yet, so prepare. */
export function PreQuitPrepCard() {
  const m = useMessages();
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-[20px] font-semibold tracking-tight text-ink">{m.home.prep.title}</h2>
      <ul className="flex flex-col gap-2">
        {m.home.prep.tips.map((tip) => (
          <li key={tip} className="flex gap-2 text-[14px] leading-relaxed text-ink-muted">
            <span aria-hidden="true" className="text-primary">
              ·
            </span>
            {tip}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * "What's changing in your body right now" — up to three live milestones in a
 * horizontal snap-scroller.
 *
 * The emerging-evidence filter is applied BEFORE `happeningNow`, not after, so
 * hiding early-evidence entries can never leave the user with a blank strip
 * where the engine would otherwise have had something to show. If nothing is
 * live at all (an edge state: quit moment just passed, or every window has
 * closed), the nearest upcoming milestone stands in with a "Starting soon"
 * caption instead of a meaningless empty progress bar.
 */
export function BodyNowCarousel({
  states,
  showEmergingEvidence,
  onOpenMilestone,
}: BodyNowCarouselProps) {
  const m = useMessages();
  const visible = filterEmerging(states, showEmergingEvidence);

  const live = happeningNow(visible).slice(0, 3);
  const startingSoon = live.length === 0;
  const shown = startingSoon ? upcomingSoon(visible, 1) : live;

  if (shown.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[20px] font-semibold tracking-tight text-ink">
        {m.home.bodyNow.title}
      </h2>

      <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1">
        {shown.map((state) => (
          <MilestoneNowCard
            key={state.milestone.id}
            state={state}
            startingSoon={startingSoon}
            onOpen={() => onOpenMilestone(state.milestone)}
          />
        ))}
      </div>
    </section>
  );
}

export default BodyNowCarousel;
