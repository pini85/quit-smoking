'use client';

import { useMemo, useState } from 'react';
import type { Locale } from '@/domain/types';
import { MIN_NIGHTS_BASELINE, type SnoreTrends } from '@/domain/snore/trends';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
import { dateFmt, numberFmt } from '@/lib/i18n/fmt';
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

/** Burden is a whole score; events/hr carries one decimal (matching `MorningResults`). */
function formatMetricValue(value: number, metric: ChartMetric, locale: Locale): string {
  return metric === 'eventsPerHour'
    ? numberFmt(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
    : numberFmt(locale).format(value);
}

/**
 * Gated (>= `MIN_NIGHTS_BASELINE` analyzable nights) night-over-night chart
 * — burden or events/hr, toggled via `SegmentedControl` — the three-way
 * side-by-side the brief asks for (last night / rolling 7-night mean /
 * baseline, all for whichever metric the toggle is on), plus a list of
 * correlation-safe comparison sentences from `trends.vsBaseline`. Every
 * `vsBaseline` entry was computed against the SAME reference bucket, so
 * `sinceReference` (which baseline that was) is derived once and shared by
 * every sentence rather than re-guessed per metric.
 *
 * The side-by-side prints raw means with no arrows or percentages: it exists
 * so the 7-night mean the `vsBaseline` sentences are actually built from is
 * visible rather than implied, and turning it into a second set of deltas
 * would just restate those sentences less carefully. Each row appears only
 * when its own bucket cleared its own gate in `computeSnoreTrends` (`null`
 * means "not enough nights", never "zero"), and the whole block is hidden
 * below two rows, since one number is not a comparison.
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

  const comparisonRows = useMemo(() => {
    const c = m.sleep.trends.comparison;
    const rows: { key: string; label: string; value: number }[] = [];
    if (trends.lastNight !== null) {
      rows.push({ key: 'lastNight', label: c.lastNight, value: trends.lastNight[metric] });
    }
    if (trends.sevenNightAvg !== null) {
      rows.push({
        key: 'sevenNights',
        label: interpolate(c.sevenNights, { nights: trends.sevenNightAvg.nights }),
        value: trends.sevenNightAvg.means[metric],
      });
    }
    // Same precedence `computeSnoreTrends` uses for its reference bucket:
    // pre-quit nights when there are enough of them, else the first nights.
    const baseline = trends.preQuitBaseline ?? trends.firstNightsBaseline;
    if (baseline !== null) {
      rows.push({
        key: 'baseline',
        label: trends.preQuitBaseline !== null ? c.baselinePreQuit : c.baselineFirstNights,
        value: baseline.means[metric],
      });
    }
    return rows;
  }, [trends, metric, m]);

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
        {comparisonRows.length >= 2 ? (
          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink-faint">
              {m.sleep.trends.comparison.title}
            </h3>
            <dl className="flex flex-col gap-1">
              {comparisonRows.map((row) => (
                <div key={row.key} className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] leading-relaxed text-ink-muted">{row.label}</dt>
                  <dd className="text-[13px] font-medium tabular-nums text-ink">
                    {formatMetricValue(row.value, metric, locale)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
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
