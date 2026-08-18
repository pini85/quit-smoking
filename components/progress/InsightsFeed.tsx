'use client';

import { useMemo } from 'react';
import type { CravingSession } from '@/domain/types';
import { generateInsights } from '@/domain/stats/insights';
import { useLocale, useMessages } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

export type InsightsFeedProps = {
  sessions: CravingSession[];
  quitAt: Date;
  now: Date;
};

const DAY_MS = 86_400_000;

/**
 * Rotates through the FULL deterministic rule output (requested with
 * `limit: 99`, so effectively uncapped — there are only 7 rules) so a
 * returning user sees different true facts on different days instead of
 * being stuck with the same top-3 forever. The rotation offset is applied
 * to the full ordered list BEFORE slicing to 3, per the brief: on a day
 * where the full output is `[A,B,C,D,E]`, day 0 shows `[A,B,C]`, and two
 * days later (offset 2) it shows `[C,D,E]` — nothing is ever invented,
 * everything eligible surfaces eventually.
 */
export function InsightsFeed({ sessions, quitAt, now }: InsightsFeedProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const shown = useMemo(() => {
    const full = generateInsights(sessions, quitAt, now, 99, locale);
    if (full.length === 0) return [];
    const daysSinceEpoch = Math.floor(now.getTime() / DAY_MS);
    const offset = daysSinceEpoch % full.length;
    const rotated = [...full.slice(offset), ...full.slice(0, offset)];
    return rotated.slice(0, 3);
  }, [sessions, quitAt, now, locale]);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">{m.progress.insights.title}</h2>
      {shown.length === 0 ? (
        <EmptyState>{m.progress.insights.empty}</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((insight) => (
            <Card key={insight.id} className="flex flex-col gap-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-faint">
                <span aria-hidden="true">💡</span> {m.progress.insights.fromYourData}
              </p>
              <p className="text-[14px] leading-relaxed text-ink">{insight.text}</p>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default InsightsFeed;
