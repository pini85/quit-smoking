'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

export type RingPulseProps = {
  /**
   * Increment to play exactly one expanding, fading stroke. The value itself
   * is meaningless — only the change matters — and the first render never
   * pulses, so mounting an already-celebrated screen stays quiet.
   */
  trigger: number;
  className?: string;
};

const CLEANUP_MS = 1200;

export function RingPulse({ trigger, className }: RingPulseProps) {
  const lastTrigger = useRef(trigger);
  const [pulseKey, setPulseKey] = useState<number | null>(null);
  // `globals.css` zeroes the animation duration under reduced motion, which
  // would otherwise leave the ring parked at full opacity for the whole
  // cleanup window and then blink out. A pulse that cannot expand is not
  // worth drawing at all, so render nothing.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    setPulseKey(trigger);
  }, [trigger]);

  useEffect(() => {
    if (pulseKey === null) return;
    const timer = setTimeout(() => setPulseKey(null), CLEANUP_MS);
    return () => clearTimeout(timer);
  }, [pulseKey]);

  if (pulseKey === null || reducedMotion) return null;

  return (
    <span
      key={pulseKey}
      aria-hidden="true"
      className={`animate-ring-pulse pointer-events-none absolute inset-0 rounded-full border-2 border-accent ${className ?? ''}`}
    />
  );
}

export default RingPulse;
