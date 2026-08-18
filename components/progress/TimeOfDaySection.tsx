'use client';

import { useMemo } from 'react';
import type { CravingSession } from '@/domain/types';
import { hourHistogram, hardestWindow } from '@/domain/stats/cravingStats';
import { startOfLocalDay } from '@/domain/time';
import { HourHeatStrip } from '@/components/charts/HourHeatStrip';
import { interpolate, useMessages } from '@/lib/i18n';
import { GatedCard } from './GatedCard';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export type TimeOfDaySectionProps = {
  sessions: CravingSession[];
};

/**
 * `hardestWindow`'s `endHour` is EXCLUSIVE (window = `[startHour, endHour)`,
 * spanning exactly 3 clock-hours). The caption reuses that exclusive hour
 * directly — `{start}:00–{end}:00` — matching the display convention
 * already established in `domain/stats/insights.ts`'s peak-hours rule.
 * `HourHeatStrip.highlightRange`, however, is documented as an INCLUSIVE
 * hour range, so it gets the last covered hour (`startHour + 2`), not the
 * exclusive `endHour` itself.
 */
export function TimeOfDaySection({ sessions }: TimeOfDaySectionProps) {
  const m = useMessages();
  const { gateMet, counts, highlightRange, caption } = useMemo(() => {
    const distinctDays = new Set(
      sessions.map((s) => startOfLocalDay(new Date(s.startedAt)).getTime())
    ).size;
    const gateMet = sessions.length >= 10 && distinctDays >= 7;
    const counts = hourHistogram(sessions);
    const window = hardestWindow(sessions);
    const highlightRange = window
      ? { start: window.startHour, end: (window.startHour + 2) % 24 }
      : undefined;
    const caption = window
      ? interpolate(m.progress.timeOfDay.caption, {
          start: pad2(window.startHour),
          end: pad2(window.endHour),
        })
      : null;
    return { gateMet, counts, highlightRange, caption };
  }, [sessions, m.progress.timeOfDay.caption]);

  return (
    <GatedCard
      title={m.progress.timeOfDay.title}
      gateMet={gateMet}
      emptyCopy={m.progress.timeOfDay.empty}
    >
      <div className="flex flex-col gap-2">
        <HourHeatStrip
          counts={counts}
          highlightRange={highlightRange}
          ariaLabel={m.progress.timeOfDay.ariaLabel}
        />
        {caption ? <p className="text-[13px] leading-relaxed text-ink-muted">{caption}</p> : null}
      </div>
    </GatedCard>
  );
}

export default TimeOfDaySection;
