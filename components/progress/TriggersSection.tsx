'use client';

import { useMemo } from 'react';
import type { CravingSession, Trigger } from '@/domain/types';
import { perTriggerStats } from '@/domain/stats/cravingStats';
import { TRIGGER_META, TRIGGER_ORDER } from '@/data/triggers';
import { BarList, type BarListItem } from '@/components/charts/BarList';
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
        label: `${meta.emoji} ${meta.label}`,
        value: s.total,
        sub: `${pct}% of tagged · ${passPct} passed`,
      };
    });

    return { gateMet, items };
  }, [sessions]);

  return (
    <GatedCard
      title="Triggers"
      gateMet={gateMet}
      emptyCopy="Tag a few cravings with what set them off, and your patterns show up here. Most people are surprised by their real #1 trigger."
    >
      <BarList items={items} ariaLabel="Cravings by trigger, with share of tagged cravings and pass rate" />
    </GatedCard>
  );
}

export default TriggersSection;
