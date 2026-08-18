'use client';

import Link from 'next/link';
import type { CravingOutcome, CravingSession, Locale } from '@/domain/types';
import { cravingCounts } from '@/domain/stats/cravingStats';
import { triggerLabel } from '@/data/triggers';
import { interpolate, useLocale, useMessages, type Messages } from '@/lib/i18n';
import { dateFmt } from '@/lib/i18n/fmt';
import { Card } from '@/components/ui/Card';

export type WinsStripProps = {
  cravings: CravingSession[];
};

const OUTCOME_KEYS: Record<
  Exclude<CravingOutcome, 'unresolved'>,
  keyof Messages['home']['wins']['outcomes']
> = {
  passed: 'passed',
  'much-weaker': 'muchWeaker',
  'still-there': 'stillThere',
  smoked: 'smoked',
};

function isResolved(
  session: CravingSession
): session is CravingSession & { outcome: Exclude<CravingOutcome, 'unresolved'> } {
  return session.outcome !== null && session.outcome !== 'unresolved';
}

function timeOf(iso: string, locale: Locale): string {
  return dateFmt(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
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
  const { locale } = useLocale();
  const m = useMessages();
  const sessions = cravings.filter((session) => session.preQuit !== true);
  const { resolved, passedWithoutSmoking } = cravingCounts(sessions);

  if (resolved === 0) {
    return (
      <Card>
        <p className="text-[14px] leading-relaxed text-ink-muted">{m.home.wins.invite}</p>
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

  const trigger = last.trigger ? triggerLabel(last.trigger, locale) : m.home.wins.untagged;
  const final = last.finalIntensity ?? '—';

  return (
    <Link href="/progress" className="block rounded-card">
      <Card className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold leading-snug text-ink">
          {interpolate(
            resolved === 1 ? m.home.wins.countLineOne : m.home.wins.countLineOther,
            { passed: passedWithoutSmoking, resolved }
          )}
        </p>
        <p className="text-[13px] leading-relaxed tabular-nums text-ink-muted">
          {timeOf(last.startedAt, locale)} · {trigger} · {last.initialIntensity} → {final} ·{' '}
          {m.home.wins.outcomes[OUTCOME_KEYS[last.outcome]]}
        </p>
      </Card>
    </Link>
  );
}

export default WinsStrip;
