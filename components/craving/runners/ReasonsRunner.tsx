'use client';

import type { PersonalReason } from '@/domain/types';
import { Button } from '@/components/ui/Button';
import { RunnerChrome } from './RunnerChrome';

export type ReasonsRunnerProps = {
  reasons: PersonalReason[];
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
};

/**
 * The user's own words, at the size of a headline, one per screen.
 *
 * Nothing here is written by us — no framing, no encouragement, no added
 * verb. A sentence someone typed about their own kids beats anything this
 * app could say, and paraphrasing it would break the whole effect.
 */
export function ReasonsRunner({ reasons, onComplete, onBack, onSkip }: ReasonsRunnerProps) {
  return (
    <RunnerChrome onBack={onBack} onSkip={onSkip}>
      <div className="w-full">
        <div className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {reasons.map((reason) => (
            <blockquote
              key={reason.id}
              className="flex min-h-56 w-[calc(100vw-2.5rem)] max-w-[26rem] shrink-0 snap-center items-center justify-center rounded-card border border-border bg-surface p-6 text-center"
            >
              <p className="text-[28px] font-medium leading-snug text-ink">
                &ldquo;{reason.text}&rdquo;
              </p>
            </blockquote>
          ))}
        </div>
        {reasons.length > 1 ? (
          <p className="mt-3 text-center text-[13px] text-ink-faint">
            Swipe for the next one
          </p>
        ) : null}
      </div>

      <Button size="lg" fullWidth onClick={onComplete} className="max-w-sm">
        Done
      </Button>
    </RunnerChrome>
  );
}

export default ReasonsRunner;
