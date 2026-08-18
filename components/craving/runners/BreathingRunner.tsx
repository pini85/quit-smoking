'use client';

import { useEffect, useRef, useState } from 'react';
import { Ring } from '@/components/ui/Ring';
import { useNow } from '@/lib/hooks/useNow';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { RunnerChrome } from './RunnerChrome';

export type BreathingRunnerProps = {
  onComplete: () => void;
  onBack: () => void;
  onSkip: () => void;
};

const INHALE_MS = 4000;
const EXHALE_MS = 6000;
const CYCLES = 6; // 6 x 10s = 60s

const INHALE_COPY = 'Breathe in…';
const EXHALE_COPY = '…and let it go';

/**
 * Seconds left in the current phase, for the reduced-motion variant. Split
 * into its own component so the one-second clock is only ever subscribed to
 * when it is actually on screen — the animated variant re-renders twice per
 * ten seconds, not ten times.
 */
function PhaseCountdown({ endsAt }: { endsAt: number }) {
  const now = useNow(1000);
  const remaining = Math.max(0, Math.ceil((endsAt - now.getTime()) / 1000));
  return (
    <span className="text-[64px] font-semibold leading-none tabular-nums text-ink">
      {remaining}
    </span>
  );
}

/**
 * A long exhale is the only thing in this app that changes how someone feels
 * within seconds — it is a physiological lever (vagal), not a distraction,
 * which is why it leads at high intensity.
 *
 * The phase machine is duplicated here rather than read out of `<Ring/>`
 * because the ring owns the *animation* and this component owns the *copy*
 * and the cycle count; both start from the same mount with the same
 * durations. Under reduced motion the ring stops expanding (the CSS token
 * collapses to 1) and a plain per-phase countdown carries the pacing instead.
 */
export function BreathingRunner({ onComplete, onBack, onSkip }: BreathingRunnerProps) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<'inhale' | 'exhale'>('inhale');
  const [completedCycles, setCompletedCycles] = useState(0);
  const [phaseEndsAt, setPhaseEndsAt] = useState(() => Date.now() + INHALE_MS);

  // Kept in a ref so the timer chain below never restarts because a parent
  // re-rendered with a fresh callback identity — restarting would silently
  // reset the user's breathing to cycle 1.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let current: 'inhale' | 'exhale' = 'inhale';
    let done = 0;
    setPhase('inhale');
    setCompletedCycles(0);
    setPhaseEndsAt(Date.now() + INHALE_MS);

    let timer = setTimeout(function next() {
      if (current === 'inhale') {
        current = 'exhale';
        setPhase('exhale');
        setPhaseEndsAt(Date.now() + EXHALE_MS);
        timer = setTimeout(next, EXHALE_MS);
        return;
      }
      done += 1;
      setCompletedCycles(done);
      if (done >= CYCLES) {
        onCompleteRef.current();
        return;
      }
      current = 'inhale';
      setPhase('inhale');
      setPhaseEndsAt(Date.now() + INHALE_MS);
      timer = setTimeout(next, INHALE_MS);
    }, INHALE_MS);

    return () => clearTimeout(timer);
  }, []);

  const inhaling = phase === 'inhale';

  return (
    <RunnerChrome onBack={onBack} onSkip={onSkip}>
      <Ring
        mode="breathing"
        size={240}
        breathing={{ inhaleMs: INHALE_MS, exhaleMs: EXHALE_MS, running: true }}
      >
        {reducedMotion ? (
          <PhaseCountdown endsAt={phaseEndsAt} />
        ) : (
          <span aria-hidden="true" className="text-[15px] text-ink-faint">
            {inhaling ? '4' : '6'}
          </span>
        )}
      </Ring>

      <p aria-live="polite" className="text-[24px] font-medium text-ink">
        {inhaling ? INHALE_COPY : EXHALE_COPY}
      </p>

      <div
        className="flex items-center gap-2"
        role="img"
        aria-label={`Breath ${Math.min(completedCycles + 1, CYCLES)} of ${CYCLES}`}
      >
        {Array.from({ length: CYCLES }, (_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${
              i < completedCycles ? 'bg-primary' : 'bg-ring-track'
            }`}
          />
        ))}
      </div>
    </RunnerChrome>
  );
}

export default BreathingRunner;
