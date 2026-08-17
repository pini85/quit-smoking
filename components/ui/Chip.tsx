import type { ReactNode } from 'react';

export type ChipSize = 'sm' | 'md';

export type ChipProps = {
  selected?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  /** `md` (default) clears the 44px touch target; `sm` is a 36px dense pill. */
  size?: ChipSize;
  className?: string;
  disabled?: boolean;
};

const SIZES: Record<ChipSize, string> = {
  sm: 'min-h-9 px-3.5 text-[13px]',
  md: 'min-h-11 px-4 text-sm',
};

export function Chip({
  selected = false,
  onClick,
  children,
  size = 'md',
  className,
  disabled = false,
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={[
        'inline-flex items-center justify-center rounded-full border font-medium',
        'transition-transform duration-[var(--dur-press)] active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-45',
        selected
          ? 'bg-primary-soft border-primary text-primary-strong'
          : 'bg-surface border-border text-ink-muted',
        SIZES[size],
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  );
}

export default Chip;
