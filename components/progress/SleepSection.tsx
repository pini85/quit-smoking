'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { SleepSession } from '@/domain/types';
import { computeSnoreTrends } from '@/domain/snore/trends';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
import { numberFmt } from '@/lib/i18n/fmt';
import { Card } from '@/components/ui/Card';
import { formatVsBaselineCompact } from '@/components/sleep/sleepService';

export type SleepSectionProps = {
  sessions: SleepSession[];
  quitAt: Date;
  now: Date;
};

/**
 * /progress entry card for snore monitoring: an honest invitation until at
 * least one night is analyzable, then last night's burden plus the same
 * compact baseline comparison `MorningResults` shows. Always links through
 * to `/sleep`, matching the home screen's `WinsStrip` -> `/progress` idiom.
 */
export function SleepSection({ sessions, quitAt, now }: SleepSectionProps) {
  const { locale } = useLocale();
  const m = useMessages();

  const trends = useMemo(() => computeSnoreTrends(sessions, quitAt, now), [sessions, quitAt, now]);

  if (trends.lastNight === null) {
    return (
      <Link href="/sleep" className="block rounded-card">
        <Card className="flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold text-ink">{m.sleep.progressEntry.title}</h2>
          <p className="text-[14px] leading-relaxed text-ink-muted">{m.sleep.progressEntry.invite}</p>
          <p className="text-[13px] font-medium text-primary-strong">{m.sleep.progressEntry.cta}</p>
        </Card>
      </Link>
    );
  }

  const burdenComparison = trends.vsBaseline.find((c) => c.metric === 'snoreBurden');
  const burden = numberFmt(locale).format(trends.lastNight.snoreBurden);

  return (
    <Link href="/sleep" className="block rounded-card">
      <Card className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold text-ink">{m.sleep.progressEntry.title}</h2>
        <p className="text-[14px] leading-relaxed tabular-nums text-ink">
          {interpolate(m.sleep.progressEntry.lastNightLine, { burden })}
        </p>
        {burdenComparison ? (
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {formatVsBaselineCompact(burdenComparison.deltaPercent, m.sleep.results)}
          </p>
        ) : null}
        <p className="text-[13px] font-medium text-primary-strong">{m.sleep.progressEntry.cta}</p>
      </Card>
    </Link>
  );
}

export default SleepSection;
