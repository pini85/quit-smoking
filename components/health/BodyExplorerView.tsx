import Link from 'next/link';
import { MILESTONE_CATEGORIES, type MilestoneCategory } from '@/domain/types';
import type { MilestoneState } from '@/domain/milestones/engine';
import { categoryProgress } from '@/domain/milestones/engine';
import { CATEGORY_META } from './categoryMeta';
import { filterEmerging } from './filterEmerging';

export type BodyExplorerViewProps = {
  states: MilestoneState[];
  showEmergingEvidence: boolean;
};

function CategoryTile({
  category,
  progress,
}: {
  category: MilestoneCategory;
  progress?: { achieved: number; happeningNow: number; total: number };
}) {
  const meta = CATEGORY_META[category];
  const underway = (progress?.achieved ?? 0) + (progress?.happeningNow ?? 0);
  const total = progress?.total ?? 0;

  return (
    <Link
      href={`/health/${category}`}
      className="flex min-h-11 flex-col gap-1 rounded-card border border-border bg-surface p-4 shadow-sm transition-transform duration-[var(--dur-press)] active:scale-[0.98] dark:shadow-none"
    >
      <span aria-hidden="true" className="text-[22px] leading-none">
        {meta.emoji}
      </span>
      <span className="text-[14px] font-semibold leading-snug text-ink">{meta.label}</span>
      <span className="text-[12px] text-ink-faint">
        {underway} of {total} underway
      </span>
    </Link>
  );
}

/**
 * The full body map — every category, whether or not anything is happening
 * there yet, so the explorer works as a reference as much as a dashboard.
 *
 * `categoryProgress`'s `total`/`achieved`/`happeningNow` counts are computed
 * from the emerging-filtered list, so a category's "{k} of {n}" caption is
 * also implicitly gated by `showEmergingEvidence` (an emerging milestone
 * in a category counts toward neither number when the preference is off).
 */
export function BodyExplorerView({ states, showEmergingEvidence }: BodyExplorerViewProps) {
  const visible = filterEmerging(states, showEmergingEvidence);

  const progress = categoryProgress(visible);

  return (
    <div className="grid grid-cols-2 gap-3">
      {MILESTONE_CATEGORIES.map((category) => (
        <CategoryTile key={category} category={category} progress={progress[category]} />
      ))}
    </div>
  );
}

export default BodyExplorerView;
