'use client';

import type { HealthMilestone } from '@/domain/types';
import { HEALTH_MILESTONES } from '@/data/healthMilestones';
import { startOfLocalDay } from '@/domain/time';
import { useLocalPref } from '@/lib/hooks/useLocalPref';
import { Card } from '@/components/ui/Card';

const STORAGE_KEY = 'unsmoke.discovery.dismissed';
const DAY_MS = 86_400_000;

const POOL: HealthMilestone[] = HEALTH_MILESTONES.filter((m) => m.didYouKnow === true);

/** Whole local days since the epoch — changes exactly at local midnight. */
export function daysSinceEpoch(now: Date): number {
  return Math.floor(startOfLocalDay(now).getTime() / DAY_MS);
}

function localDateKey(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type DiscoveryCardProps = {
  now: Date;
  onOpenMilestone: (milestone: HealthMilestone) => void;
};

/**
 * One fact a day, and never two days running — a curiosity, not a feed.
 *
 * Which fact you get is a pure function of the date, so it can't shuffle
 * under you on a re-render, and the "already dismissed" flag lives in
 * `localStorage` rather than IndexedDB: it's a throwaway UI preference, not
 * user data worth exporting or migrating. `useLocalPref` keeps that read out
 * of render, and reports `undefined` until it has actually happened so the
 * card never flashes in before hiding itself.
 */
export function DiscoveryCard({ now, onOpenMilestone }: DiscoveryCardProps) {
  const { value: dismissedOn, set: setDismissedOn } = useLocalPref(STORAGE_KEY);

  const today = localDateKey(now);
  const dayNumber = daysSinceEpoch(now);
  const milestone = POOL.length > 0 ? POOL[dayNumber % POOL.length] : null;

  // Every other day only, per the "never two days running" rule.
  const scheduledToday = dayNumber % 2 === 0;

  if (
    dismissedOn === undefined ||
    !scheduledToday ||
    milestone === null ||
    dismissedOn === today
  ) {
    return null;
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-accent">
          Did you know?
        </p>
        <button
          type="button"
          onClick={() => setDismissedOn(today)}
          aria-label="Dismiss today's discovery"
          className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.92]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <p className="text-[15px] font-semibold leading-snug text-ink">{milestone.title}</p>

      <p className="line-clamp-3 text-[13px] leading-relaxed text-ink-muted">
        {milestone.description}
      </p>

      <button
        type="button"
        onClick={() => onOpenMilestone(milestone)}
        className="min-h-11 self-start text-[13px] font-medium text-primary-strong"
      >
        read more →
      </button>
    </Card>
  );
}

export default DiscoveryCard;
