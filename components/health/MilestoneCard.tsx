import type { MilestoneState } from '@/domain/milestones/engine';
import { Card } from '@/components/ui/Card';
import { EvidenceBadge } from '@/components/ui/EvidenceBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CATEGORY_META } from './categoryMeta';

export type FullMilestoneCardProps = {
  state: MilestoneState;
  onOpen: () => void;
  /**
   * Category detail is the one place emerging-evidence entries always
   * render regardless of `showEmergingEvidence` — so it also always shows
   * the caveat inline on the card, not just inside the sheet, since the
   * badge alone doesn't carry that nuance.
   */
  showEmergingCaveat?: boolean;
};

/**
 * The full-detail milestone card: category caption, title, description,
 * evidence badge, progress (when the milestone is a live window), and the
 * honest-note callout. Shared by the "Happening now" list on Right Now and
 * the category detail page, so the two views can't drift apart.
 */
export function FullMilestoneCard({ state, onOpen, showEmergingCaveat }: FullMilestoneCardProps) {
  const { milestone, progress } = state;
  const category = CATEGORY_META[milestone.category];

  return (
    <Card onClick={onOpen} className="flex flex-col gap-3">
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
        <span aria-hidden="true">{category.emoji}</span> {category.label}
      </p>

      <p className="text-[15px] font-semibold leading-snug text-ink">{milestone.title}</p>

      <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-muted">
        {milestone.description}
      </p>

      <div className="flex flex-col items-start gap-2">
        <EvidenceBadge level={milestone.evidenceLevel} />
        {showEmergingCaveat && milestone.evidenceLevel === 'emerging' ? (
          <p className="text-[12px] leading-relaxed text-ink-faint">
            Early evidence — we&rsquo;re telling you because it&rsquo;s interesting, not proven.
          </p>
        ) : null}
      </div>

      {progress !== undefined ? (
        <ProgressBar value={progress} label="Progress through this change" />
      ) : null}

      {milestone.honestNote ? (
        <p className="rounded-xl bg-accent-soft px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
          {milestone.honestNote}
        </p>
      ) : null}
    </Card>
  );
}

export default FullMilestoneCard;
