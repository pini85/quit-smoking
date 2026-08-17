'use client';

import { useEffect, useRef, useState } from 'react';

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

  if (pulseKey === null) return null;

  return (
    <span
      key={pulseKey}
      aria-hidden="true"
      className={`animate-ring-pulse pointer-events-none absolute inset-0 rounded-full border-2 border-accent ${className ?? ''}`}
    />
  );
}

export default RingPulse;
