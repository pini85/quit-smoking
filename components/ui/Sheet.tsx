'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Kept in a ref so the effects below depend only on `open` — a consumer
  // passing an inline arrow must not re-run the history effect every render.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // `aria-modal` only *claims* the rest of the page is inert — Tab must be
    // contained by hand, and whatever opened the sheet has to get focus back
    // when it closes, or keyboard users are dumped on <body>.
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute('disabled'));

      const active = document.activeElement;

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const outside = !(active instanceof Node) || !panel.contains(active) || active === panel;

      if (event.shiftKey) {
        if (outside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (outside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;

      const restoreTo = restoreFocusRef.current;
      restoreFocusRef.current = null;
      // Skip if the opener has since left the document (e.g. the whole screen
      // unmounted) — focusing a detached node is a no-op that silently loses
      // focus anyway.
      if (restoreTo?.isConnected) restoreTo.focus();
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
      {/* Pointer-only affordance: kept out of the tab order and hidden from
          assistive tech, which reach the same action through the X below. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="animate-sheet-up relative max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+24px)] outline-none"
      >
        <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="mb-4 flex min-h-11 items-center justify-between gap-3">
          {title ? (
            <h2 id={titleId} className="text-[17px] font-semibold text-ink">
              {title}
            </h2>
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
