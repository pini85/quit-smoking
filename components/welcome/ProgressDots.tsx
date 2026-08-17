export type ProgressDotsProps = {
  step: number;
  total: number;
};

/** Top-of-screen step indicator for the onboarding wizard. Decorative — the
 * screen's own heading already announces which step this is. */
export function ProgressDots({ step, total }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-[width,background-color] duration-[var(--dur-press)] ${
            n === step ? 'w-6 bg-primary' : 'w-1.5 bg-border'
          }`}
        />
      ))}
    </div>
  );
}

export default ProgressDots;
