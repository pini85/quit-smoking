'use client';

import type { CravingSession, Trigger } from '@/domain/types';
import { triggerLabel } from '@/data/triggers';
import {
  alreadyProved,
  avgFinalIntensity,
  avgInitialIntensity,
  resolvedSessions,
} from '@/domain/stats/cravingStats';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { interpolate, useLocale, useMessages } from '@/lib/i18n';
import { RunnerChrome } from './RunnerChrome';

export type ProofRunnerProps = {
  trigger: Trigger;
  /** History, EXCLUDING the session in progress. */
  sessions: CravingSession[];
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
};

/**
 * The only interrupter that argues, and it argues with the user's own
 * record rather than with a statistic about strangers. It is gated behind
 * `alreadyProved` (>= 3 resolved sessions on this trigger) and can never be
 * the primary suggestion — evidence is what you read once the panic is
 * already coming down.
 */
export function ProofRunner({
  trigger,
  sessions,
  onComplete,
  onBack,
  onSkip,
}: ProofRunnerProps) {
  const { locale } = useLocale();
  const m = useMessages();
  const proof = alreadyProved(sessions, trigger);
  const label = triggerLabel(trigger, locale);

  // Same session set on both sides of the arrow, so "from a to b" compares
  // like with like rather than averaging different populations.
  const measured = resolvedSessions(sessions).filter(
    (s) => s.trigger === trigger && s.finalIntensity !== undefined
  );
  const from = avgInitialIntensity(measured);
  const to = avgFinalIntensity(measured);
  // Only claimed when the numbers actually show a fade — no spun statistics.
  const fades = from !== null && to !== null && to < from;

  return (
    <RunnerChrome onBack={onBack} onSkip={onSkip}>
      <Card className="w-full max-w-sm">
        <p className="text-[24px] font-medium leading-snug text-ink">
          {interpolate(m.craving.runner.proofQuestion, {
            label,
            total: proof?.total ?? 0,
            passed: proof?.passed ?? 0,
          })}
        </p>
        {fades ? (
          <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">
            {interpolate(m.craving.runner.proofFade, { from: from as number, to: to as number })}
          </p>
        ) : null}
      </Card>

      <Button size="lg" fullWidth onClick={onComplete} className="max-w-sm">
        {m.craving.runner.done}
      </Button>
    </RunnerChrome>
  );
}

export default ProofRunner;
