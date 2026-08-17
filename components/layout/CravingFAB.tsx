'use client';

import Link from 'next/link';

export type CravingFABProps = {
  className?: string;
};

/**
 * The one always-reachable escape hatch. Docked in the centre of the tab bar
 * and raised above it, breathing slowly so it reads as alive but never
 * urgent. Amber appears only on press.
 *
 * The breathe animation lives on a wrapper rather than on the link itself:
 * both want the `transform` property, and a running keyframe animation wins
 * over a transition, which silently killed the press-scale feedback.
 */
export function CravingFAB({ className }: CravingFABProps) {
  return (
    <span className={`animate-fab-breathe inline-flex rounded-full ${className ?? ''}`}>
      <Link
        href="/craving"
        className="flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-full bg-gradient-to-br from-primary to-primary-strong text-canvas shadow-lg ring-0 ring-accent/50 transition-[transform,box-shadow] duration-[var(--dur-press)] active:scale-[0.96] active:ring-4"
      >
        <svg
          width="22"
          height="18"
          viewBox="0 0 18 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M1.5 4q2.25-3 4.5 0t4.5 0t4.5 0" />
          <path d="M1.5 8q2.25-3 4.5 0t4.5 0t4.5 0" opacity="0.8" />
          <path d="M1.5 12q2.25-3 4.5 0t4.5 0t4.5 0" opacity="0.6" />
        </svg>
        <span className="text-[11px] font-medium leading-none">Craving</span>
      </Link>
    </span>
  );
}

export default CravingFAB;
