'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
};

/**
 * Bottom sheet. Closes on overlay tap, the X, Escape, and — importantly on
 * Android — the hardware back button: opening pushes a throwaway history
 * entry so `popstate` closes the sheet instead of leaving the app. Closing
 * through the UI pops that entry back off so history stays clean.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  // Kept in a ref so the effects below depend only on `open` — a consumer
  // passing an inline arrow must not re-run the history effect every render.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    window.history.pushState({ __unsmokeSheet: true }, '');
    let closedByBack = false;

    const onPopState = () => {
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      // Closed through the UI: retire our own entry so a later back press
      // doesn't have to be pressed twice. Guarded so we never eat someone
      // else's history entry.
      const state = window.history.state as { __unsmokeSheet?: boolean } | null;
      if (!closedByBack && state?.__unsmokeSheet === true) {
        window.history.back();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-up relative max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+24px)] outline-none"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="mb-4 flex min-h-11 items-center justify-between gap-3">
          {title ? (
            <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-transform duration-[var(--dur-press)] active:scale-[0.92]"
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

        {children}
      </div>
    </div>
  );
}

export default Sheet;
