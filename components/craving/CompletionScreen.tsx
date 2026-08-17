'use client';

import { useDeferredValue } from 'react';
import { Button } from '@/components/ui/Button';
import { RingPulse } from '@/components/ui/RingPulse';

export type CompletionVariant = 'win' | 'logged';

export type CompletionScreenProps = {
  variant: CompletionVariant;
  initialIntensity: number;
  finalIntensity?: number;
  /** Running total of cravings resolved without a cigarette. */
  passedCount: number;
  onDone: () => void;
};

const WIN_LINE = 'That loop just got weaker. It’s physiology, not luck.';
const LOGGED_LINE = 'Logged. Stepping away is a real strategy — it passes either way.';

/**
 * The end of a session that did not involve a cigarette.
 *
 * One ripple, no confetti: the claim being made is a physiological one, and
 * a party animation would undercut it. The number pair is the actual
 * evidence — it is the user's own before-and-after, not a score.
 */
export function CompletionScreen({
  variant,
  initialIntensity,
  finalIntensity,
  passedCount,
  onDone,
}: CompletionScreenProps) {
  // RingPulse deliberately never fires on its first render (so that merely
  // mounting an already-celebrated screen stays quiet), which means the
  // celebration has to be armed one commit later. `useDeferredValue`'s
  // initial-value form does exactly that — 0 on the first render, 1 on the
  // next — without an effect that writes state back into React.
  const pulse = useDeferredValue(1, 0);

  return (
    <div className="animate-fade-in flex min-h-[80dvh] flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-primary-soft">
          <RingPulse trigger={pulse} />
          {finalIntensity === undefined ? (
            <span className="relative text-[40px] font-semibold tabular-nums text-ink">
              {initialIntensity}
            </span>
          ) : (
            <span className="relative text-[40px] font-semibold tabular-nums text-ink">
              {initialIntensity} <span aria-label="down to">&rarr;</span> {finalIntensity}
            </span>
          )}
        </div>

        <p className="max-w-sm text-[19px] leading-relaxed text-ink">
          {variant === 'win' ? WIN_LINE : LOGGED_LINE}
        </p>

        {variant === 'win' ? (
          <p className="text-[15px] text-ink-muted">
            Cravings passed without smoking: {passedCount}
          </p>
        ) : null}
      </div>

      <Button size="lg" fullWidth onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

export default CompletionScreen;
