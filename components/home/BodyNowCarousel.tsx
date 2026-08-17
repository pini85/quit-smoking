'use client';

import type { HealthMilestone } from '@/domain/types';
import type { MilestoneState } from '@/domain/milestones/engine';
import { happeningNow, upcomingSoon } from '@/domain/milestones/engine';
import { Card } from '@/components/ui/Card';
import { EvidenceBadge } from '@/components/ui/EvidenceBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CATEGORY_META } from '@/components/health/categoryMeta';

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
          <p className="text-[12px] text-ink-faint">Starting soon</p>
        ) : progress !== undefined ? (
          <ProgressBar value={progress} label="Progress through this change" />
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

const PREP_TIPS = [
  'Halve your coffee — quitting doubles caffeine’s kick',
  'Bin the ashtrays and lighters tonight',
  'Tell one person your quit moment',
];

/** Pre-quit stand-in for the carousel: nothing is changing yet, so prepare. */
export function PreQuitPrepCard() {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-[20px] font-semibold tracking-tight text-ink">While you wait</h2>
      <ul className="flex flex-col gap-2">
        {PREP_TIPS.map((tip) => (
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
  const visible = showEmergingEvidence
    ? states
    : states.filter((s) => s.milestone.evidenceLevel !== 'emerging');

  const live = happeningNow(visible).slice(0, 3);
  const startingSoon = live.length === 0;
  const shown = startingSoon ? upcomingSoon(visible, 1) : live;

  if (shown.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[20px] font-semibold tracking-tight text-ink">
        What&rsquo;s changing in your body right now
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
