import type { MilestoneState, MilestoneStatus } from '@/domain/milestones/engine';
import { Card } from '@/components/ui/Card';
import { EvidenceBadge } from '@/components/ui/EvidenceBadge';
import { humanizeEta } from '@/components/home/humanizeEta';
import { useLocale } from '@/lib/i18n';
import { CATEGORY_META } from './categoryMeta';

/** Compact "arriving soon" card: category, title, and a vague ETA. */
export function CompactUpcomingCard({
  state,
  onOpen,
}: {
  state: MilestoneState;
  onOpen: () => void;
}) {
  const { locale } = useLocale();
  const { milestone, startsInMs } = state;
  const category = CATEGORY_META[milestone.category];

  return (
    <Card onClick={onOpen} className="flex flex-col gap-1.5 !p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
        <span aria-hidden="true">{category.emoji}</span> {category.label}
      </p>
      <p className="text-[14px] font-medium leading-snug text-ink">{milestone.title}</p>
      <p className="text-[12px] text-ink-faint">{humanizeEta(startsInMs ?? 0, locale)}</p>
    </Card>
  );
}

/** Compact "recently completed" row: a checkmark and the title. */
export function CompactAchievedRow({
  state,
  onOpen,
}: {
  state: MilestoneState;
  onOpen: () => void;
}) {
  const { milestone } = state;
  const category = CATEGORY_META[milestone.category];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 w-full items-center gap-3 rounded-card border border-border bg-surface px-4 py-2 text-left transition-transform duration-[var(--dur-press)] active:scale-[0.99]"
    >
      <span aria-hidden="true" className="shrink-0 text-primary-strong">
        ✓
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate text-[13px] font-medium text-ink">{milestone.title}</span>
        <span className="block text-[11px] text-ink-faint">
          {category.emoji} {category.label}
        </span>
      </span>
    </button>
  );
}

/** Achieved / happening-now / upcoming glyph shared by the timeline rows. */
export function StatusIcon({ status }: { status: MilestoneStatus }) {
  if (status === 'achieved') {
    return (
      <span aria-hidden="true" className="shrink-0 text-primary-strong">
        ✓
      </span>
    );
  }
  if (status === 'happening-now') {
    return (
      <span aria-hidden="true" className="shrink-0 text-accent motion-safe:animate-pulse">
        ●
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="shrink-0 text-ink-faint">
      ○
    </span>
  );
}

/** One row inside an expanded time-band section: status glyph, title, mini evidence badge. */
export function TimelineRow({ state, onOpen }: { state: MilestoneState; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 w-full items-center gap-3 text-left"
    >
      <StatusIcon status={state.status} />
      <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-ink">
        {state.milestone.title}
      </span>
      <EvidenceBadge level={state.milestone.evidenceLevel} className="shrink-0" />
    </button>
  );
}

export default TimelineRow;
