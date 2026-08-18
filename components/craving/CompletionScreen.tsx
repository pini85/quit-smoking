'use client';

import { useDeferredValue, useState } from 'react';
import type { Belief, Trigger } from '@/domain/types';
import { BELIEF_META, TRIGGER_BELIEF_SUGGESTIONS } from '@/data/beliefs';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { RingPulse } from '@/components/ui/RingPulse';

export type CompletionVariant = 'win' | 'logged';

export type CompletionScreenProps = {
  variant: CompletionVariant;
  initialIntensity: number;
  finalIntensity?: number;
  /** Running total of cravings resolved without a cigarette. */
  passedCount: number;
  /** Narrows which promises are offered; absent is fine and common. */
  trigger?: Trigger;
  /** Already-tagged promise, if this session somehow carries one. */
  beliefId?: Belief;
  /** Omit to leave the promise question off this screen entirely. */
  onBeliefChange?: (beliefId: Belief | undefined) => void;
  onDone: () => void;
};

const WIN_LINE = 'That loop just got weaker. It’s physiology, not luck.';
const LOGGED_LINE = 'Logged. Stepping away is a real strategy — it passes either way.';

const BELIEF_LABEL = 'What was it promising? — optional';

/**
 * The end of a session that did not involve a cigarette.
 *
 * One ripple, no confetti: the claim being made is a physiological one, and
 * a party animation would undercut it. The number pair is the actual
 * evidence — it is the user's own before-and-after, not a score.
 *
 * The promise question is the one thing asked here, and it is asked now
 * precisely because the craving is over: a moment ago it would have been a
 * screen between someone and help. It is optional, it is one glance, it sits
 * below the message and above Done, and Done works whether or not it is
 * answered.
 */
export function CompletionScreen({
  variant,
  initialIntensity,
  finalIntensity,
  passedCount,
  trigger,
  beliefId,
  onBeliefChange,
  onDone,
}: CompletionScreenProps) {
  // RingPulse deliberately never fires on its first render (so that merely
  // mounting an already-celebrated screen stays quiet), which means the
  // celebration has to be armed one commit later. `useDeferredValue`'s
  // initial-value form does exactly that — 0 on the first render, 1 on the
  // next — without an effect that writes state back into React.
  const pulse = useDeferredValue(1, 0);

  // Latched at mount, exactly as the trigger row latches on the re-check and
  // slip screens: a session that already carries a promise is not asked again,
  // and once the row is on screen it stays there, so a mis-tapped chip can be
  // tapped a second time to clear it.
  const [askBelief] = useState(() => beliefId === undefined);
  // "Something else" — an answer, not a selection. It writes nothing and
  // simply closes the question.
  const [dismissed, setDismissed] = useState(false);

  // Suggestions for the context when there is one. 'other' doubles as the
  // generic list: it holds the everyday in-the-moment promises rather than the
  // long-run fears, which is exactly what fits a craving minutes old.
  const suggestions = TRIGGER_BELIEF_SUGGESTIONS[trigger ?? 'other'];
  const showBelief = askBelief && !dismissed && onBeliefChange !== undefined;

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

      {/* Below the message, above Done — and never in front of it. The session
          is already written and closed by the time this screen exists, so an
          unanswered question costs nothing at all. */}
      {showBelief ? (
        <div className="mb-5">
          <p className="mb-2 text-[13px] text-ink-muted">{BELIEF_LABEL}</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {suggestions.map((id) => {
              const selected = beliefId === id;
              return (
                <Chip
                  key={id}
                  selected={selected}
                  onClick={() => onBeliefChange?.(selected ? undefined : id)}
                  className="shrink-0 whitespace-nowrap"
                >
                  {BELIEF_META[id].label}
                </Chip>
              );
            })}
            <Chip
              onClick={() => setDismissed(true)}
              className="shrink-0 whitespace-nowrap"
            >
              Something else
            </Chip>
          </div>
        </div>
      ) : null}

      <Button size="lg" fullWidth onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

export default CompletionScreen;
