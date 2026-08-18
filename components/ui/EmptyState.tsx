import type { ReactNode } from 'react';
import { Card } from './Card';

export type EmptyStateProps = {
  children?: ReactNode;
  /** Optional decorative glyph rendered above the copy. */
  icon?: ReactNode;
  className?: string;
  /**
   * Renders the same centered, muted copy WITHOUT the wrapping `Card` — for
   * callers that already provide their own card (e.g. `GatedCard`, which
   * shows a title plus this empty copy inside one shared `Card`; wrapping a
   * second `Card` around the copy there would double the border/shadow/
   * padding). Standalone call sites are unaffected: default is `false`,
   * which renders exactly as before (a `Card` with this same inner layout).
   */
  bare?: boolean;
};

const INNER_CLASSES = 'flex flex-col items-center gap-3 py-8 text-center';

export function EmptyState({ children, icon, className, bare }: EmptyStateProps) {
  const content = (
    <>
      {icon ? (
        <span aria-hidden="true" className="text-ink-faint">
          {icon}
        </span>
      ) : null}
      <div className="max-w-[28ch] text-balance text-sm leading-relaxed text-ink-muted">
        {children}
      </div>
    </>
  );

  if (bare) {
    return <div className={`${INNER_CLASSES} ${className ?? ''}`}>{content}</div>;
  }

  return <Card className={`${INNER_CLASSES} ${className ?? ''}`}>{content}</Card>;
}

export default EmptyState;
