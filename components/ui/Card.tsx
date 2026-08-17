import type { ReactNode } from 'react';

export type CardProps = {
  className?: string;
  children?: ReactNode;
  /**
   * When supplied the card becomes a real `<button>` so it is keyboard
   * reachable and announced as pressable — a `<div onClick>` would be
   * neither. Only pass this from a client component.
   */
  onClick?: () => void;
};

const BASE =
  'bg-surface border border-border rounded-card p-5 shadow-sm dark:shadow-none';

export function Card({ className, children, onClick }: CardProps) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${BASE} w-full min-h-11 text-left transition-transform duration-[var(--dur-press)] active:scale-[0.99] ${className ?? ''}`}
      >
        {children}
      </button>
    );
  }

  return <div className={`${BASE} ${className ?? ''}`}>{children}</div>;
}

export default Card;
