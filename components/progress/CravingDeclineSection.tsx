'use client';

import { useMemo } from 'react';
import type { CravingSession } from '@/domain/types';
import { weeklyCounts, avgInitialIntensity } from '@/domain/stats/cravingStats';
import { isoWeekKey } from '@/domain/time';
import { TrendLine, type TrendPoint } from '@/components/charts/TrendLine';
import { useMessages } from '@/lib/i18n';
import { GatedCard } from './GatedCard';

const SEVEN_DAYS_MS = 7 * 86_400_000;

/** '2026-W34' -> 'W34' — compact enough for the chart's edge labels. */
function shortWeekLabel(weekKey: string): string {
  const idx = weekKey.indexOf('W');
  return idx === -1 ? weekKey : weekKey.slice(idx);
}

export type CravingDeclineSectionProps = {
  sessions: CravingSession[];
  quitAt: Date;
  now: Date;
};

/**
 * Hero card: two stacked TrendLines sharing the same week buckets
 * (`weeklyCounts`) — one of raw counts, one of average starting intensity.
 * The intensity series skips weeks with zero sessions rather than plotting
 * a fabricated zero (`avgInitialIntensity` would be `null` there, and a
 * `null` y-value has no honest meaning on this chart).
 */
export function CravingDeclineSection({ sessions, quitAt, now }: CravingDeclineSectionProps) {
  const m = useMessages();
  const { gateMet, countSeries, intensitySeries } = useMemo(() => {
    const gateMet = now.getTime() - quitAt.getTime() >= SEVEN_DAYS_MS && sessions.length >= 5;
    const weekly = weeklyCounts(sessions, quitAt, now);
    const countSeries: TrendPoint[] = weekly.map((w) => ({
      x: shortWeekLabel(w.weekKey),
      y: w.count,
    }));

    const byWeek = new Map<string, CravingSession[]>();
    for (const s of sessions) {
      const key = isoWeekKey(new Date(s.startedAt));
      const arr = byWeek.get(key);
      if (arr) arr.push(s);
      else byWeek.set(key, [s]);
    }
    const intensitySeries: TrendPoint[] = weekly
      .filter((w) => (byWeek.get(w.weekKey)?.length ?? 0) > 0)
      .map((w) => ({
        x: shortWeekLabel(w.weekKey),
        y: avgInitialIntensity(byWeek.get(w.weekKey) as CravingSession[]) as number,
      }));

    return { gateMet, countSeries, intensitySeries };
  }, [sessions, quitAt, now]);

  return (
    <GatedCard
      title={m.progress.cravingDecline.title}
      gateMet={gateMet}
      emptyCopy={m.progress.cravingDecline.empty}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink-muted">{m.progress.cravingDecline.perWeek}</p>
          <TrendLine series={countSeries} ariaLabel={m.progress.cravingDecline.ariaCounts} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink-muted">
            {m.progress.cravingDecline.avgIntensity}
          </p>
          <TrendLine series={intensitySeries} ariaLabel={m.progress.cravingDecline.ariaIntensity} />
        </div>
      </div>
    </GatedCard>
  );
}

export default CravingDeclineSection;
