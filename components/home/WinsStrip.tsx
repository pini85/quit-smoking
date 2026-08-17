'use client';

import Link from 'next/link';
import type { CravingOutcome, CravingSession } from '@/domain/types';
import { cravingCounts } from '@/domain/stats/cravingStats';
import { TRIGGER_META } from '@/data/triggers';
import { Card } from '@/components/ui/Card';

export type WinsStripProps = {
  cravings: CravingSession[];
};

const OUTCOME_WORDS: Record<Exclude<CravingOutcome, 'unresolved'>, string> = {
  passed: 'Passed',
  'much-weaker': 'Much weaker',
  'still-there': 'Outlasted',
  smoked: 'Logged honestly',
};

function isResolved(
  session: CravingSession
): session is CravingSession & { outcome: Exclude<CravingOutcome, 'unresolved'> } {
  return session.outcome !== null && session.outcome !== 'unresolved';
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Proof, not praise: how many cravings the user has actually outlasted, plus
 * the last one in full detail — including the ones that ended in a cigarette,
 * which are shown in the same neutral voice as the rest.
 *
 * `preQuit` sessions are excluded here (they were logged while still smoking,
 * so "passed without smoking" wouldn't mean the same thing), and the count
 * line only appears once at least one session has RESOLVED — otherwise it
 * would read "0 of 0", which is worse than the invitation copy.
 */
export function WinsStrip({ cravings }: WinsStripProps) {
  const sessions = cravings.filter((session) => session.preQuit !== true);
  const { resolved, passedWithoutSmoking } = cravingCounts(sessions);

  if (resolved === 0) {
    return (
      <Card>
        <p className="text-[14px] leading-relaxed text-ink-muted">
          When a craving hits, the button below is the move. It takes about 3
          minutes. Freedom is for the time in between.
        </p>
      </Card>
    );
  }

  const last = sessions
    .filter(isResolved)
    .reduce((latest, session) =>
      new Date(session.startedAt).getTime() > new Date(latest.startedAt).getTime()
        ? session
        : latest
    );

  const trigger = last.trigger ? TRIGGER_META[last.trigger].label : 'untagged';
  const final = last.finalIntensity ?? '—';

  return (
    <Link href="/progress" className="block rounded-card">
      <Card className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold leading-snug text-ink">
          {passedWithoutSmoking} of {resolved} craving{resolved === 1 ? '' : 's'} passed
          without smoking
        </p>
        <p className="text-[13px] leading-relaxed tabular-nums text-ink-muted">
          {timeOf(last.startedAt)} · {trigger} · {last.initialIntensity} → {final} ·{' '}
          {OUTCOME_WORDS[last.outcome]}
        </p>
      </Card>
    </Link>
  );
}

export default WinsStrip;
