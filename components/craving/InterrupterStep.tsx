'use client';

import { useMemo, useState } from 'react';
import type { CravingSession, Trigger } from '@/domain/types';
import { INTERVENTIONS, type Intervention, type InterventionKind } from '@/data/interventions';
import { alreadyProved } from '@/domain/stats/cravingStats';
import { pickInterventions } from '@/lib/services/interventionPicker';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export type InterrupterStepProps = {
  intensity: number;
  trigger?: Trigger;
  /** History, EXCLUDING the session in progress. */
  sessions: CravingSession[];
  reasonsCount: number;
  /** Most recent first, INCLUDING what this session already tried. */
  recentInterventionIds: string[];
  roundCount: number;
  onStart: (kind: InterventionKind) => void;
};

function byId(kind: InterventionKind): Intervention {
  return INTERVENTIONS.find((i) => i.id === kind) as Intervention;
}

/**
 * Step 2 — the chooser. Two taps from opening the app to doing something
 * about the craving: the intensity, then Start.
 *
 * Only two options are offered up front. A seven-item menu is a decision, and
 * a decision is exactly what nobody mid-craving has spare capacity for; the
 * rest stay one quiet tap away for the minority who want to browse.
 */
export function InterrupterStep({
  intensity,
  trigger,
  sessions,
  reasonsCount,
  recentInterventionIds,
  roundCount,
  onStart,
}: InterrupterStepProps) {
  const [showMore, setShowMore] = useState(false);

  const { primary, alternative } = useMemo(
    () =>
      pickInterventions({
        intensity,
        trigger,
        sessions,
        reasonsCount,
        recentInterventionIds,
      }),
    [intensity, trigger, sessions, reasonsCount, recentInterventionIds]
  );

  // The same two gates the picker enforces, applied to the "more ways" list:
  // never offer reasons the user never wrote, or proof they haven't earned.
  const rest = useMemo(() => {
    const proofUnlocked = trigger !== undefined && alreadyProved(sessions, trigger) !== null;
    return INTERVENTIONS.filter((i) => {
      if (i.id === primary || i.id === alternative) return false;
      if (i.requiresReasons && reasonsCount === 0) return false;
      if (i.requiresTriggerHistory && !proofUnlocked) return false;
      return true;
    });
  }, [primary, alternative, reasonsCount, sessions, trigger]);

  const primaryIntervention = byId(primary);
  const alternativeIntervention = byId(alternative);

  return (
    <div className="flex min-h-[80dvh] flex-col">
      <p className="pt-6 text-[17px] text-ink-muted">
        {roundCount > 1 ? 'Round two. Something else, then.' : "Let's do something about it."}
      </p>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-[24px] font-semibold leading-tight text-ink">
              {primaryIntervention.title}
            </h2>
            <p className="mt-1 text-[15px] text-ink-muted">{primaryIntervention.tagline}</p>
          </div>
          <Button size="lg" fullWidth onClick={() => onStart(primary)}>
            Start
          </Button>
        </Card>

        <button
          type="button"
          onClick={() => onStart(alternative)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-card border border-border bg-surface px-5 py-3.5 text-left transition-transform duration-[var(--dur-press)] active:scale-[0.99]"
        >
          <span>
            <span className="block text-[16px] font-medium text-ink">
              {alternativeIntervention.title}
            </span>
            <span className="block text-[13px] text-ink-muted">
              {alternativeIntervention.tagline}
            </span>
          </span>
          <span aria-hidden="true" className="text-ink-faint">
            &rarr;
          </span>
        </button>

        {showMore ? (
          <div className="animate-fade-in flex flex-col gap-2">
            {rest.map((intervention) => (
              <button
                key={intervention.id}
                type="button"
                onClick={() => onStart(intervention.id)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-button px-3 py-2.5 text-left transition-transform duration-[var(--dur-press)] active:scale-[0.99]"
              >
                <span>
                  <span className="block text-[15px] font-medium text-ink">
                    {intervention.title}
                  </span>
                  <span className="block text-[13px] text-ink-faint">
                    {intervention.tagline}
                  </span>
                </span>
                <span aria-hidden="true" className="text-ink-faint">
                  &rarr;
                </span>
              </button>
            ))}
          </div>
        ) : rest.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="mx-auto min-h-11 px-4 text-[15px] text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.97]"
          >
            more ways &rarr;
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default InterrupterStep;
