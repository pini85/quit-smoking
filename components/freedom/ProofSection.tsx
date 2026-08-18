'use client';

import { useMemo } from 'react';
import type { CravingSession, Trigger } from '@/domain/types';
import { perTriggerStats } from '@/domain/stats/cravingStats';
import { triggerProof } from '@/domain/freedom/evidence';
import { TRIGGER_META, TRIGGER_ORDER, triggerLabel } from '@/data/triggers';
import { Card } from '@/components/ui/Card';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';

export type ProofSectionProps = {
  sessions: CravingSession[];
};

/**
 * The user's own log, read back flatly: the one or two contexts they have the
 * most cravings in, with what actually happened in them.
 *
 * Real counts belong HERE and nowhere near the belief map — this is evidence
 * the user generated, not a grade on how their beliefs are doing. Each
 * candidate still has to clear `triggerProof`'s own >= 3-resolved gate, so a
 * count is never shown thinly; below that gate the whole section renders
 * nothing rather than a hedged sentence, because an empty card here would be
 * an invitation to log cravings, which is the Progress screen's job.
 *
 * The counts read "N times", the wording `proofLine` uses in
 * `domain/freedom/evidence.ts`, because `triggerProof` counts RESOLVED
 * sessions only: a craving still open appears in neither number, so calling
 * the first one "logged" would quietly overstate what happened.
 *
 * Ordering is by raw `perTriggerStats` total with a `TRIGGER_ORDER` tie-break,
 * the same deterministic arrangement `TriggersSection` uses.
 */
export function ProofSection({ sessions }: ProofSectionProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const rows = useMemo(() => {
    const perTrig = perTriggerStats(sessions);
    const entries = Object.entries(perTrig) as [
      Trigger,
      { total: number; passed: number; rate: number | null },
    ][];

    const sorted = [...entries].sort((a, b) => {
      if (b[1].total !== a[1].total) return b[1].total - a[1].total;
      return TRIGGER_ORDER.indexOf(a[0]) - TRIGGER_ORDER.indexOf(b[0]);
    });

    const proven: { trigger: Trigger; total: number; passed: number }[] = [];
    for (const [trigger] of sorted) {
      const proof = triggerProof(sessions, trigger);
      if (proof === null) continue;
      proven.push({ trigger, total: proof.total, passed: proof.passed });
      if (proven.length === 2) break;
    }
    return proven;
  }, [sessions]);

  if (rows.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">
          {m.freedom.proof.heading}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          {m.freedom.proof.subheading}
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map(({ trigger, total, passed }) => {
          const meta = TRIGGER_META[trigger];
          return (
            <li key={trigger} className="flex flex-col gap-0.5">
              <span className="text-[14px] font-medium text-ink">
                <span aria-hidden="true">{meta.emoji}</span> {triggerLabel(trigger, locale)}
              </span>
              <span className="text-[13px] tabular-nums text-ink-muted">
                {interpolate(m.freedom.proof.row, { total, passed })}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default ProofSection;
