'use client';

import { useMemo } from 'react';
import type { CravingSession, Trigger } from '@/domain/types';
import { perTriggerStats } from '@/domain/stats/cravingStats';
import { TRIGGER_META, TRIGGER_ORDER, triggerLabel } from '@/data/triggers';
import { BarList, type BarListItem } from '@/components/charts/BarList';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
import { GatedCard } from './GatedCard';

export type TriggersSectionProps = {
  sessions: CravingSession[];
};

/**
 * BarList of triggers by raw count, sorted descending; ties break by the
 * app's canonical `TRIGGER_ORDER` (same tie-break spirit as
 * `strongestTrigger`/the insight rules elsewhere in `domain/stats`, kept
 * deterministic rather than depending on object key iteration order).
 */
export function TriggersSection({ sessions }: TriggersSectionProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const { gateMet, items } = useMemo(() => {
    const perTrig = perTriggerStats(sessions);
    const entries = Object.entries(perTrig) as [
      Trigger,
      { total: number; passed: number; rate: number | null },
    ][];
    const totalTagged = entries.reduce((sum, [, s]) => sum + s.total, 0);
    const gateMet = totalTagged >= 8;

    const sorted = [...entries].sort((a, b) => {
      if (b[1].total !== a[1].total) return b[1].total - a[1].total;
      return TRIGGER_ORDER.indexOf(a[0]) - TRIGGER_ORDER.indexOf(b[0]);
    });

    const items: BarListItem[] = sorted.map(([trigger, s]) => {
      const meta = TRIGGER_META[trigger];
      const pct = totalTagged > 0 ? Math.round((s.total / totalTagged) * 100) : 0;
      const passPct = s.rate === null ? '—' : `${Math.round(s.rate * 100)}%`;
      return {
        label: `${meta.emoji} ${triggerLabel(trigger, locale)}`,
        value: s.total,
        sub: interpolate(m.progress.triggers.subLine, { pct, passPct }),
      };
    });

    return { gateMet, items };
  }, [sessions, locale, m.progress.triggers.subLine]);

  return (
    <GatedCard
      title={m.progress.triggers.title}
      gateMet={gateMet}
      emptyCopy={m.progress.triggers.empty}
    >
      <BarList items={items} ariaLabel={m.progress.triggers.ariaLabel} />
    </GatedCard>
  );
}

export default TriggersSection;
