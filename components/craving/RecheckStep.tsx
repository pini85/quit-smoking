'use client';

import { useState } from 'react';
import type { Trigger } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { IntensityScale } from './IntensityScale';
import { TriggerChips } from './TriggerChips';

export type RecheckStepProps = {
  initialIntensity: number;
  finalIntensity?: number;
  trigger?: Trigger;
  roundCount: number;
  onTriggerChange: (trigger: Trigger | undefined) => void;
  onSelectIntensity: (intensity: number) => void;
  onPassed: () => void;
  onMuchWeaker: () => void;
  onSmoked: () => void;
  onTryAnother: () => void;
  onLogStillThere: () => void;
};

/**
 * Step 3 — the measurement that makes the whole app work. Every "it faded
 * from 8 to 3" the user will ever be shown is collected right here.
 *
 * The four outcomes are deliberately ordered and weighted: the good ones
 * lead, and "I smoked" is the quietest thing on screen but is never hidden,
 * never behind a confirm, and never coloured like a warning. The moment
 * logging a slip feels like a punishment is the moment slips stop being
 * logged at all.
 */
export function RecheckStep({
  initialIntensity,
  finalIntensity,
  trigger,
  roundCount,
  onTriggerChange,
  onSelectIntensity,
  onPassed,
  onMuchWeaker,
  onSmoked,
  onTryAnother,
  onLogStillThere,
}: RecheckStepProps) {
  const [stillThereOpen, setStillThereOpen] = useState(false);
  // Latched at mount: once the row is on screen it stays on screen, so a
  // mis-tapped chip can be tapped again to clear it.
  const [askTrigger] = useState(() => trigger === undefined);

  return (
    <div className="flex min-h-[80dvh] flex-col">
      <h1 className="pt-6 text-[28px] font-semibold leading-tight text-ink">
        How strong is it now?
      </h1>

      <div className="mt-auto flex flex-col gap-5 pt-8">
        <IntensityScale
          value={finalIntensity}
          previous={initialIntensity}
          onSelect={onSelectIntensity}
        />

        {askTrigger ? (
          <TriggerChips
            label="What set it off? (optional)"
            value={trigger}
            onChange={onTriggerChange}
          />
        ) : null}

        {finalIntensity === undefined ? null : (
          <div className="animate-fade-in flex flex-col gap-2">
            <Button size="lg" fullWidth onClick={onPassed}>
              Gone
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={onMuchWeaker}
            >
              Much weaker
            </Button>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={() => setStillThereOpen(true)}
            >
              Still there
            </Button>
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              onClick={onSmoked}
            >
              I smoked
            </Button>
          </div>
        )}
      </div>

      <Sheet open={stillThereOpen} onClose={() => setStillThereOpen(false)}>
        <p className="mb-5 text-[19px] leading-relaxed text-ink">
          That&rsquo;s okay &mdash; some take two rounds.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            fullWidth
            onClick={() => {
              setStillThereOpen(false);
              onTryAnother();
            }}
          >
            Try another way
          </Button>
          {/* Offered only once a second round has actually happened: telling
              someone to put the phone down before they've tried anything else
              would be giving up on their behalf. */}
          {roundCount >= 2 ? (
            <Button
              variant="ghost"
              size="lg"
              fullWidth
              onClick={() => {
                setStillThereOpen(false);
                onLogStillThere();
              }}
            >
              Log it and step away from the phone
            </Button>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}

export default RecheckStep;
