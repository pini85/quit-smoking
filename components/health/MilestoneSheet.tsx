'use client';

import type { HealthMilestone } from '@/domain/types';
import { milestoneState, type MilestoneStatus } from '@/domain/milestones/engine';
import { hoursBetween } from '@/domain/time';
import { useLocale } from '@/lib/i18n';
import { Sheet } from '@/components/ui/Sheet';
import { EvidenceBadge } from '@/components/ui/EvidenceBadge';
import { CATEGORY_META } from './categoryMeta';
import { fmt, timingPhrase } from './timingPhrase';
import { localizedMilestone } from '@/data/healthMilestones';

export type MilestoneSheetProps = {
  /** `null` closes the sheet — lets callers keep one nullable piece of state. */
  milestone: HealthMilestone | null;
  onClose: () => void;
  /**
   * Clock context for the "Why am I seeing this?" block — every caller only
   * ever opens a sheet once it already has a resolved quit moment, so these
   * are plain `Date`s rather than nullable.
   */
  quitAt: Date;
  now: Date;
};

const STATUS_CHIP: Record<MilestoneStatus, { icon: string; label: string }> = {
  achieved: { icon: '✓', label: 'Achieved' },
  'happening-now': { icon: '●', label: 'Happening now' },
  upcoming: { icon: '○', label: 'Upcoming' },
  'no-timeline': { icon: '—', label: 'Always true' },
};

/**
 * The one place a milestone is explained in full: what it is, how strong the
 * evidence is, the honest caveat where one exists, where the claim comes
 * from, and — via the "Why am I seeing this?" block — why it's showing up
 * for THIS user right now. Shared by the Today screen and the health
 * screens; deliberately owns no data-fetching of its own, but does take a
 * `quitAt`/`now` pair so it can place the milestone on the user's own
 * timeline without any caller having to precompute a `MilestoneState`.
 */
export function MilestoneSheet({ milestone, onClose, quitAt, now }: MilestoneSheetProps) {
  const { locale } = useLocale();
  const category = milestone ? CATEGORY_META[milestone.category] : null;
  const state = milestone ? milestoneState(milestone, quitAt, now) : null;
  const chip = state ? STATUS_CHIP[state.status] : null;
  const elapsed = fmt(Math.max(0, hoursBetween(quitAt, now)), locale);
  const text = milestone ? localizedMilestone(milestone, locale) : null;
  // `noTimeline` phrases travel with the localized milestone text rather
  // than being re-derived by `timingPhrase`, which only ever echoes
  // `timing.phrase` verbatim — see timingPhrase.ts's own doc comment.
  const localizedTiming =
    milestone && text && milestone.timing.kind === 'noTimeline' && text.phrase
      ? { ...milestone.timing, phrase: text.phrase }
      : milestone?.timing;

  return (
    <Sheet open={milestone !== null} onClose={onClose} title={text?.title}>
      {milestone && category && chip && text && localizedTiming ? (
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
            <span aria-hidden="true">{category.emoji}</span> {category.label}
          </p>

          <p className="text-[15px] leading-relaxed text-ink-muted">
            {text.description}
          </p>

          <p className="text-[13px] italic leading-relaxed text-ink-faint">
            {timingPhrase(localizedTiming, locale)}
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

          {text.honestNote ? (
            <p className="rounded-card bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-ink-muted">
              {text.honestNote}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Why am I seeing this?
            </p>

            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-ink-muted">
              <span aria-hidden="true">{chip.icon}</span>
              {chip.label}
            </span>

            <p className="text-[13px] leading-relaxed text-ink-muted">
              Shown because you&rsquo;re {elapsed} in and this typically occurs{' '}
              {timingPhrase(localizedTiming, locale)}.
            </p>

            {milestone.sources.length > 0 ? (
              <div className="flex flex-col gap-2">
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
        </div>
      ) : null}
    </Sheet>
  );
}

export default MilestoneSheet;
