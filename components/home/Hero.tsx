'use client';

import { useMemo, useState } from 'react';
import type { HealthMilestone } from '@/domain/types';
import { HEALTH_MILESTONES } from '@/data/healthMilestones';
import { computeMilestoneStates, nextMilestone } from '@/domain/milestones/engine';
import { formatDurationDigital, formatSmokeFreeDuration } from '@/domain/time';
import { RECOVERY_STAGE_LABELS, recoveryStage } from '@/domain/stats/quitStats';
import { useNow } from '@/lib/hooks/useNow';
import { Ring } from '@/components/ui/Ring';
import { humanizeEta } from './humanizeEta';

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

export type HeroProps = {
  quitAt: Date;
  onOpenMilestone: (milestone: HealthMilestone) => void;
};

/** earliestHours of every dated milestone, ascending — computed once. */
const DATED_HOURS: number[] = HEALTH_MILESTONES.map((m) =>
  m.timing.kind === 'noTimeline' ? null : m.timing.earliestHours
)
  .filter((h): h is number => h !== null)
  .sort((a, b) => a - b);

/**
 * Progress toward the next milestone: elapsed-in-gap / total-gap, where the
 * gap runs from the previous dated milestone's `earliestHours` (0 if none) to
 * the next one's. Clamped to 0–1; a full ring means nothing is left ahead.
 */
function progressTowardNext(elapsedHours: number, nextHours: number | null): number {
  if (nextHours === null) return 1;

  let previousHours = 0;
  for (const hours of DATED_HOURS) {
    if (hours <= elapsedHours && hours > previousHours) previousHours = hours;
  }

  const gap = nextHours - previousHours;
  if (!(gap > 0)) return 1;
  return Math.min(1, Math.max(0, (elapsedHours - previousHours) / gap));
}

/**
 * `formatDurationDigital` grows a character per decade of days, and the ring
 * gives the readout ~232px. At 40px a tabular digit is ~24px wide, so once
 * the string passes 11 characters (100+ days elapsed, which a long-quit user
 * reaches permanently) it no longer fits and would wrap mid-number. Stepping
 * the size down keeps it on one line out to a 27-year quit and beyond.
 */
function digitalSizeClass(text: string): string {
  if (text.length <= 11) return 'text-[40px]';
  if (text.length <= 13) return 'text-[32px]';
  return 'text-[26px]';
}

/**
 * The screen's centre of gravity: one ring, one number, and the next thing
 * your body is about to do.
 *
 * This is the ONLY component on Today that ticks every second — everything
 * else runs off `useNow(60000)` — so the per-second re-render stays contained
 * to this subtree. The milestone maths is memoised on the current *minute* so
 * 80 milestone states aren't recomputed 60 times a minute for a caption that
 * only ever says "in about 3h".
 */
export function Hero({ quitAt, onOpenMilestone }: HeroProps) {
  const now = useNow(1000);
  const [precise, setPrecise] = useState(false);

  const quitAtMs = quitAt.getTime();
  const nowMs = now.getTime();
  const elapsedMs = nowMs - quitAtMs;
  const preQuit = elapsedMs < 0;

  const minuteKey = Math.floor(nowMs / MINUTE_MS);
  const next = useMemo(() => {
    const at = new Date(minuteKey * MINUTE_MS);
    const anchor = new Date(quitAtMs);
    const states = computeMilestoneStates(HEALTH_MILESTONES, anchor, at);
    return nextMilestone(states, anchor, at);
  }, [minuteKey, quitAtMs]);

  const elapsedHours = Math.max(0, elapsedMs) / HOUR_MS;
  const nextHours =
    next && next.state.milestone.timing.kind !== 'noTimeline'
      ? next.state.milestone.timing.earliestHours
      : null;
  const progress = preQuit ? 1 : progressTowardNext(elapsedHours, nextHours);

  const stage = recoveryStage(quitAt, now);
  const smokeFree = formatSmokeFreeDuration(quitAt, now);
  const digital = formatDurationDigital(preQuit ? quitAtMs - nowMs : elapsedMs);

  return (
    <section className="flex flex-col items-center gap-4 pt-2">
      <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-[13px] text-ink-muted">
        <span aria-hidden="true" className="text-primary">
          ●
        </span>
        {preQuit ? 'Ready to start' : RECOVERY_STAGE_LABELS[stage]}
      </p>

      <button
        type="button"
        aria-pressed={precise}
        onClick={() => setPrecise((value) => !value)}
        className="rounded-full transition-transform duration-[var(--dur-press)] active:scale-[0.99]"
      >
        <Ring
          size={280}
          stroke={10}
          progress={progress}
          mode="countdown"
          // "Full amber-soft ring" for the pre-quit state. The `--accent-soft`
          // token is a background tint (near-white in light mode) and would be
          // invisible as a 10px stroke, so the soft amber accent itself is used.
          className={preQuit ? '[&_.ring-progress-arc]:stroke-accent' : undefined}
        >
          {preQuit ? (
            <>
              <span className="px-6 text-[15px] leading-tight text-ink-muted">
                Freedom starts in
              </span>
              <span
                className={`mt-2 font-semibold leading-none tabular-nums text-ink ${digitalSizeClass(digital)}`}
              >
                {digital}
              </span>
            </>
          ) : (
            <>
              <span
                className={`text-balance px-6 font-semibold leading-[1.05] tabular-nums text-ink ${
                  precise ? digitalSizeClass(digital) : 'text-[40px]'
                }`}
              >
                {precise ? digital : smokeFree.primary}
              </span>
              {!precise && smokeFree.secondary ? (
                <span className="mt-2 text-[13px] leading-tight tabular-nums text-ink-muted">
                  {smokeFree.secondary}
                </span>
              ) : null}
              <span className="mt-2 text-[13px] leading-tight text-ink-faint">
                smoke-free
              </span>
              {/* No aria-label on the button: it would replace the duration
                  itself for screen readers. The hint is added instead. */}
              <span className="sr-only">
                Tap to switch between rounded and precise time.
              </span>
            </>
          )}
        </Ring>
      </button>

      {!preQuit && next ? (
        <button
          type="button"
          onClick={() => onOpenMilestone(next.state.milestone)}
          className="min-h-11 max-w-[30ch] text-balance px-2 text-center text-[13px] leading-relaxed text-ink-muted"
        >
          Next: {next.state.milestone.title} — {humanizeEta(next.etaMs)}
        </button>
      ) : null}
    </section>
  );
}

export default Hero;
