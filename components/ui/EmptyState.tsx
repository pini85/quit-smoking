import type { ReactNode } from 'react';
import { Card } from './Card';

export type EmptyStateProps = {
  children?: ReactNode;
  /** Optional decorative glyph rendered above the copy. */
  icon?: ReactNode;
  className?: string;
};

export function EmptyState({ children, icon, className }: EmptyStateProps) {
  return (
    <Card className={`flex flex-col items-center gap-3 py-8 text-center ${className ?? ''}`}>
      {icon ? (
        <span aria-hidden="true" className="text-ink-faint">
          {icon}
        </span>
      ) : null}
      <div className="max-w-[28ch] text-balance text-sm leading-relaxed text-ink-muted">
        {children}
      </div>
    </Card>
  );
}

export default EmptyState;
