'use client';

import { useMemo } from 'react';
import type { CravingSession } from '@/domain/types';
import { firstWeekVsThisWeek, type WeekStats } from '@/domain/stats/cravingStats';
import { GatedCard } from './GatedCard';

export type BeforeVsNowSectionProps = {
  sessions: CravingSession[];
  quitAt: Date;
  now: Date;
};

/** Renders '—' for any stat that's `null` rather than a fabricated 0. */
function statLine(stats: WeekStats): string {
  const avg = stats.avgInitialIntensity === null ? '—' : stats.avgInitialIntensity.toFixed(1);
  const pass = stats.passRate === null ? '—' : `${Math.round(stats.passRate * 100)}%`;
  return `${stats.count}/wk · avg ${avg} · ${pass}`;
}

/**
 * Side-by-side week-one vs this-week comparison. Gate requires BOTH weeks
 * to have at least one session — `firstWeekVsThisWeek` only guarantees the
 * 14-day-since-quit timing gate, not that either rolling window actually
 * has data (e.g. a long craving-free stretch could leave "this week" at
 * count 0, which would make the comparison meaningless rather than just
 * sparse).
 */
export function BeforeVsNowSection({ sessions, quitAt, now }: BeforeVsNowSectionProps) {
  const { gateMet, firstWeek, thisWeek } = useMemo(() => {
    const result = firstWeekVsThisWeek(sessions, quitAt, now);
    const gateMet = result !== null && result.firstWeek.count >= 1 && result.thisWeek.count >= 1;
    return {
      gateMet,
      firstWeek: result?.firstWeek ?? null,
      thisWeek: result?.thisWeek ?? null,
    };
  }, [sessions, quitAt, now]);

  return (
    <GatedCard
      title="Before vs now"
      gateMet={gateMet}
      emptyCopy="Two weeks in, you'll see week one and this week side by side. Improvement you can point at."
    >
      {firstWeek && thisWeek ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              Week one
            </p>
            <p className="text-[14px] leading-relaxed tabular-nums text-ink">
              {statLine(firstWeek)}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-faint">
              This week
            </p>
            <p className="text-[14px] leading-relaxed tabular-nums text-ink">
              {statLine(thisWeek)}
            </p>
          </div>
        </div>
      ) : null}
    </GatedCard>
  );
}

export default BeforeVsNowSection;
