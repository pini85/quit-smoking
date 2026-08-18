'use client';

import { useMemo, useState } from 'react';
import type { Locale } from '@/domain/types';
import { MIN_NIGHTS_BASELINE, type SnoreTrends } from '@/domain/snore/trends';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
import { dateFmt } from '@/lib/i18n/fmt';
import { TrendLine, type TrendPoint } from '@/components/charts/TrendLine';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/SegmentedControl';
import { GatedCard } from '@/components/progress/GatedCard';
import { formatTrendDelta } from './sleepService';

export type SleepTrendSectionProps = {
  trends: SnoreTrends;
};

type ChartMetric = 'snoreBurden' | 'eventsPerHour';

function isChartMetric(id: string): id is ChartMetric {
  return id === 'snoreBurden' || id === 'eventsPerHour';
}

function shortDateLabel(iso: string, locale: Locale): string {
  return dateFmt(locale, { month: 'short', day: 'numeric' }).format(new Date(iso));
}

/**
 * Gated (>= `MIN_NIGHTS_BASELINE` analyzable nights) night-over-night chart
 * — burden or events/hr, toggled via `SegmentedControl` — plus a list of
 * correlation-safe comparison sentences from `trends.vsBaseline`. Every
 * `vsBaseline` entry was computed against the SAME reference bucket, so
 * `sinceReference` (which baseline that was) is derived once and shared by
 * every sentence rather than re-guessed per metric.
 */
export function SleepTrendSection({ trends }: SleepTrendSectionProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const [metric, setMetric] = useState<ChartMetric>('snoreBurden');

  const gateMet = trends.analyzableNights >= MIN_NIGHTS_BASELINE;

  const series: TrendPoint[] = useMemo(
    () => trends.nightSeries.map((n) => ({ x: shortDateLabel(n.startedAt, locale), y: n[metric] })),
    [trends.nightSeries, metric, locale]
  );

  const sinceReference: 'preQuit' | 'firstNights' | null =
    trends.preQuitBaseline !== null ? 'preQuit' : trends.firstNightsBaseline !== null ? 'firstNights' : null;

  const options: SegmentedOption[] = [
    { id: 'snoreBurden', label: m.sleep.trends.metricToggle.burden },
    { id: 'eventsPerHour', label: m.sleep.trends.metricToggle.eventsPerHour },
  ];

  return (
    <GatedCard
      title={m.sleep.trends.title}
      gateMet={gateMet}
      emptyCopy={interpolate(m.sleep.trends.empty, { nights: MIN_NIGHTS_BASELINE })}
    >
      <div className="flex flex-col gap-3">
        <SegmentedControl
          options={options}
          value={metric}
          onChange={(id) => {
            if (isChartMetric(id)) setMetric(id);
          }}
          label={m.sleep.trends.metricToggle.label}
        />
        <TrendLine
          series={series}
          ariaLabel={metric === 'snoreBurden' ? m.sleep.trends.ariaBurden : m.sleep.trends.ariaEventsPerHour}
        />
        {sinceReference !== null && trends.vsBaseline.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {trends.vsBaseline.map((comparison) => (
              <li key={comparison.metric} className="text-[13px] leading-relaxed text-ink-muted">
                {formatTrendDelta(comparison, sinceReference, m.sleep.trends)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </GatedCard>
  );
}

export default SleepTrendSection;
