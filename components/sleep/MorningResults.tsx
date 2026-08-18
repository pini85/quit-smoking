'use client';

import type { SleepSession } from '@/domain/types';
import type { SnoreTrends } from '@/domain/snore/trends';
import { intensityBand } from '@/domain/snore/metrics';
import { useLocale, useMessages } from '@/lib/i18n';
import { numberFmt } from '@/lib/i18n/fmt';
import { Card } from '@/components/ui/Card';
import { StatTile } from '@/components/ui/StatTile';
import { formatSleepDuration, formatVsBaselineCompact, vsBaselineCurrentBucket } from './sleepService';

export type MorningResultsProps = {
  session: SleepSession;
  trends: SnoreTrends;
};

/**
 * The latest completed night's own stats — shown regardless of whether this
 * night is long enough to count toward `trends` (`MIN_ANALYZABLE_MS` gates
 * baselines/series, not this display). The baseline comparison line only
 * appears when THIS night is the most recent analyzable one (reference
 * equality against `trends.lastNight`), so a too-short night never borrows a
 * comparison that actually belongs to an older, analyzable one.
 *
 * That line's copy names its own near side (`vsBaselineCurrentBucket`),
 * because the delta is the rolling 7-night mean versus the baseline as soon
 * as that window is gated in — not this one night versus the baseline, which
 * is what an unlabelled percentage sitting under this night's stat tiles
 * would have been read as.
 */
export function MorningResults({ session, trends }: MorningResultsProps) {
  const { locale } = useLocale();
  const m = useMessages();

  if (session.state === 'failed' || session.metrics === undefined) {
    return (
      <Card className="flex flex-col gap-2">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">{m.sleep.results.title}</h2>
        <p className="text-[14px] leading-relaxed text-ink-muted">{m.sleep.results.failedNote}</p>
      </Card>
    );
  }

  const metrics = session.metrics;
  const band = intensityBand(metrics.avgIntensity);
  const burdenComparison = trends.vsBaseline.find(
    (c) => c.metric === 'snoreBurden' && trends.lastNight === metrics
  );

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">{m.sleep.results.title}</h2>

      {session.interrupted === true ? (
        <p className="text-[12px] leading-relaxed text-ink-faint">{m.sleep.results.interruptedNote}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <StatTile
          label={m.sleep.results.duration}
          value={formatSleepDuration(metrics.recordingDurationMs, locale)}
        />
        <StatTile
          label={m.sleep.results.snoreDuration}
          value={formatSleepDuration(metrics.snoreDurationMs, locale)}
        />
        <StatTile
          label={m.sleep.results.eventsPerHour}
          value={numberFmt(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
            metrics.eventsPerHour
          )}
        />
        <StatTile label={m.sleep.results.avgIntensity} value={m.sleep.results.intensityBands[band]} />
        <StatTile label={m.sleep.results.burden} value={numberFmt(locale).format(metrics.snoreBurden)} />
      </div>

      {burdenComparison ? (
        <p className="text-[13px] leading-relaxed text-ink-muted">
          {formatVsBaselineCompact(
            burdenComparison.deltaPercent,
            vsBaselineCurrentBucket(trends),
            m.sleep.results
          )}
        </p>
      ) : null}
    </Card>
  );
}

export default MorningResults;
