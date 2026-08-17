'use client';

import { useMemo } from 'react';
import type { CravingSession } from '@/domain/types';
import { cravingCounts } from '@/domain/stats/cravingStats';
import { GatedCard } from './GatedCard';

const FOURTEEN_DAYS_MS = 14 * 86_400_000;

type Arrow = 'up' | 'flat' | 'down' | null;

export type PassRateSectionProps = {
  sessions: CravingSession[];
  now: Date;
};

/**
 * Big pass-rate number plus a trend arrow comparing the last 14 days to the
 * 14 days before that. The arrow is intentionally suppressed (not just
 * flattened to '→') when the prior window has fewer than 3 resolved
 * sessions — a 1-of-1 vs 1-of-2 comparison would be noise dressed up as a
 * trend.
 */
export function PassRateSection({ sessions, now }: PassRateSectionProps) {
  const { gateMet, pct, passed, resolved, arrow } = useMemo(() => {
    const counts = cravingCounts(sessions);
    const gateMet = counts.resolved >= 5;
    const pct = counts.passRate === null ? null : Math.round(counts.passRate * 100);

    const nowMs = now.getTime();
    const last14 = sessions.filter((s) => {
      const t = new Date(s.startedAt).getTime();
      return t >= nowMs - FOURTEEN_DAYS_MS && t < nowMs;
    });
    const prior14 = sessions.filter((s) => {
      const t = new Date(s.startedAt).getTime();
      return t >= nowMs - 2 * FOURTEEN_DAYS_MS && t < nowMs - FOURTEEN_DAYS_MS;
    });
    const lastCounts = cravingCounts(last14);
    const priorCounts = cravingCounts(prior14);

    let arrow: Arrow = null;
    if (
      priorCounts.resolved >= 3 &&
      lastCounts.passRate !== null &&
      priorCounts.passRate !== null
    ) {
      const lastPct = Math.round(lastCounts.passRate * 100);
      const priorPct = Math.round(priorCounts.passRate * 100);
      const delta = lastPct - priorPct;
      arrow = delta > 3 ? 'up' : delta < -3 ? 'down' : 'flat';
    }

    return {
      gateMet,
      pct,
      passed: counts.passedWithoutSmoking,
      resolved: counts.resolved,
      arrow,
    };
  }, [sessions, now]);

  const arrowGlyph = arrow === 'up' ? '↑' : arrow === 'down' ? '↓' : arrow === 'flat' ? '→' : null;
  const arrowLabel =
    arrow === 'up'
      ? 'improving versus the prior 14 days'
      : arrow === 'down'
        ? 'declining versus the prior 14 days'
        : arrow === 'flat'
          ? 'flat versus the prior 14 days'
          : undefined;

  return (
    <GatedCard
      title="Pass rate"
      gateMet={gateMet}
      emptyCopy="Five logged cravings unlock your pass rate. Most people are surprised how high it is."
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[40px] font-semibold leading-none tabular-nums text-ink">
            {pct ?? 0}%
          </span>
          {arrowGlyph ? (
            <span aria-label={arrowLabel} className="text-[18px] text-ink-muted">
              {arrowGlyph}
            </span>
          ) : null}
        </div>
        <p className="text-[13px] leading-relaxed text-ink-muted">
          {passed} of {resolved} passed without smoking
        </p>
      </div>
    </GatedCard>
  );
}

export default PassRateSection;
