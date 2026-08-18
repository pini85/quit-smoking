'use client';

import { useEffect, useRef, useState } from 'react';
import { INTERVENTIONS, localizedIntervention, type InterventionKind } from '@/data/interventions';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { useLocale } from '@/lib/i18n';
import { RunnerChrome } from './RunnerChrome';
import { UrgeWave } from './UrgeWave';

export type TimedRunnerKind = 'urge-surf' | 'delay' | 'water' | 'scene-change';

export type TimedRunnerProps = {
  kind: TimedRunnerKind;
  /** Only used to pick a starting truth card — see `truthCardOffset`. */
  sessionId: string;
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
};

/** How often the countdown re-reads the clock. Fine-grained enough that the
 *  seconds digit never visibly stutters, coarse enough to be free. */
const TICK_MS = 200;

const MINUTE_MS = 60_000;

function formatMmSs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * "Random-ish, but stable for this session": the same session always opens on
 * the same truth card (so a re-render never yanks the text mid-read), while
 * two different sessions almost always start somewhere different.
 */
function truthCardOffset(sessionId: string, cardCount: number): number {
  return (sessionId.charCodeAt(0) % 10) % cardCount;
}

/**
 * Which prompt is on screen at `elapsedMs`.
 *
 * - `delay` walks the truth cards one per MINUTE, wrapping, from a
 *   session-stable offset — five minutes, five different cards.
 * - everything else divides its own duration evenly across its prompts,
 *   which lands urge-surfing on exactly 30s per line (6 lines / 180s).
 */
function promptIndex(
  kind: TimedRunnerKind,
  elapsedMs: number,
  durationMs: number,
  promptCount: number,
  sessionId: string
): number {
  if (promptCount === 0) return 0;
  if (kind === 'delay') {
    const minute = Math.floor(elapsedMs / MINUTE_MS);
    return (truthCardOffset(sessionId, promptCount) + minute) % promptCount;
  }
  const slotMs = durationMs / promptCount;
  return Math.min(promptCount - 1, Math.floor(elapsedMs / slotMs));
}

/**
 * The shared body for every interrupter that is really just "let some time
 * pass without smoking": a big honest countdown, one line of guidance at a
 * time, and no way to fail.
 */
export function TimedRunner({ kind, sessionId, onComplete, onBack, onSkip }: TimedRunnerProps) {
  const reducedMotion = useReducedMotion();
  const { locale } = useLocale();
  const intervention = INTERVENTIONS.find((i) => i.id === (kind as InterventionKind));
  const durationMs = intervention?.durationMs ?? 60_000;
  const prompts = localizedIntervention(kind as InterventionKind, locale).prompts;

  const [elapsedMs, setElapsedMs] = useState(0);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Anchored to a wall-clock start rather than accumulated per tick, so a
    // throttled background tab resumes with the right time left instead of a
    // countdown that quietly paused while the phone was locked.
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const next = Date.now() - startedAt;
      setElapsedMs(next);
      if (next >= durationMs) {
        clearInterval(timer);
        onCompleteRef.current();
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [durationMs]);

  const remainingMs = Math.max(0, durationMs - elapsedMs);
  const progress = durationMs === 0 ? 1 : Math.min(1, elapsedMs / durationMs);
  const prompt = prompts[promptIndex(kind, elapsedMs, durationMs, prompts.length, sessionId)];

  return (
    <RunnerChrome onBack={onBack} onSkip={onSkip}>
      <div className="relative flex h-40 w-full max-w-sm items-center justify-center">
        {kind === 'urge-surf' ? (
          <UrgeWave progress={progress} reducedMotion={reducedMotion} />
        ) : null}
        <span
          className="relative text-[64px] font-semibold leading-none tabular-nums text-ink"
          aria-live="off"
        >
          {formatMmSs(remainingMs)}
        </span>
      </div>

      <p
        aria-live="polite"
        className="min-h-[5rem] max-w-sm text-center text-[19px] leading-relaxed text-ink"
      >
        {prompt}
      </p>
    </RunnerChrome>
  );
}

export default TimedRunner;
