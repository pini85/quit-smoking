'use client';

import type { HealthMilestone } from '@/domain/types';
import { Sheet } from '@/components/ui/Sheet';
import { EvidenceBadge } from '@/components/ui/EvidenceBadge';
import { CATEGORY_META } from './categoryMeta';

export type MilestoneSheetProps = {
  /** `null` closes the sheet — lets callers keep one nullable piece of state. */
  milestone: HealthMilestone | null;
  onClose: () => void;
};

/**
 * The one place a milestone is explained in full: what it is, how strong the
 * evidence is, the honest caveat where one exists, and where the claim comes
 * from. Shared by the Today screen and the health screens — deliberately owns
 * no data-fetching or clock access so any screen can hand it a milestone.
 */
export function MilestoneSheet({ milestone, onClose }: MilestoneSheetProps) {
  const category = milestone ? CATEGORY_META[milestone.category] : null;

  return (
    <Sheet open={milestone !== null} onClose={onClose} title={milestone?.title}>
      {milestone && category ? (
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
            <span aria-hidden="true">{category.emoji}</span> {category.label}
          </p>

          <p className="text-[15px] leading-relaxed text-ink-muted">
            {milestone.description}
          </p>

          <div className="flex flex-col gap-2">
            <EvidenceBadge level={milestone.evidenceLevel} className="self-start" />
            {milestone.evidenceLevel === 'emerging' ? (
              <p className="text-[13px] leading-relaxed text-ink-faint">
                Early evidence — we&rsquo;re telling you because it&rsquo;s interesting, not
                proven.
              </p>
            ) : null}
          </div>

          {milestone.honestNote ? (
            <p className="rounded-card bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
              {milestone.honestNote}
            </p>
          ) : null}

          {milestone.sources.length > 0 ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
                Source
              </p>
              {milestone.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center text-[15px] text-primary-strong underline underline-offset-4"
                >
                  {source.label}
                  <span className="ml-2 text-[12px] text-ink-faint no-underline">
                    opens online ↗
                  </span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

export default MilestoneSheet;
