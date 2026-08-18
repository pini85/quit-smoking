'use client';

import type { ReactNode } from 'react';

export type RunnerChromeProps = {
  /** Back to the chooser — the exercise wasn't the right one. */
  onBack: () => void;
  /** Straight to the re-check — the craving is already over. */
  onSkip: () => void;
  children?: ReactNode;
};

/**
 * The frame every runner shares: a quiet exit at the top-left and an equally
 * quiet "I'm done early" at the bottom. Both are always available — an
 * exercise that traps you is an exercise you learn to avoid opening.
 */
export function RunnerChrome({ onBack, onSkip, children }: RunnerChromeProps) {
  return (
    <div className="animate-fade-in flex min-h-[80dvh] flex-col">
      <div className="pt-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the other ways"
          className="-ml-3 flex h-11 w-11 items-center justify-center rounded-full text-ink-faint transition-transform duration-[var(--dur-press)] active:scale-[0.92]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
        {children}
      </div>

      <button
        type="button"
        onClick={onSkip}
        className="mx-auto min-h-11 px-4 text-[15px] text-ink-muted underline-offset-4 transition-transform duration-[var(--dur-press)] active:scale-[0.97]"
      >
        skip to check-in
      </button>
    </div>
  );
}

export default RunnerChrome;
