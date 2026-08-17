export type ProgressBarProps = {
  /** 0–1. Values outside the range are clamped. */
  value: number;
  className?: string;
  /** Optional accessible name; without it the bar is decorative. */
  label?: string;
};

export function ProgressBar({ value, className, label }: ProgressBarProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const pct = clamped * 100;

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-ring-track ${className ?? ''}`}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(pct) : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-[var(--dur-ring)] ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default ProgressBar;
