'use client';

import { useEffect, useSyncExternalStore } from 'react';

export type ToastOptions = {
  /** Adds a single amber celebration ripple behind the toast. */
  withRingPulse?: boolean;
};

type ToastItem = {
  id: number;
  message: string;
  withRingPulse: boolean;
};

const VISIBLE_MS = 3500;

// Module-level store: one toast on screen at a time, the rest queued in
// order. Deliberately framework-free so `showToast` can be called from any
// event handler without threading a context through the tree.
let current: ToastItem | null = null;
const queued: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function showToast(message: string, opts?: ToastOptions): void {
  const item: ToastItem = {
    id: nextId++,
    message,
    withRingPulse: opts?.withRingPulse ?? false,
  };

  if (current === null) {
    current = item;
  } else {
    queued.push(item);
  }
  emit();
}

/** Exported for the `<Toaster/>` timer; also useful for an explicit dismiss. */
export function dismissToast(): void {
  current = queued.shift() ?? null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ToastItem | null {
  return current;
}

// Stable across renders, as the useSyncExternalStore server contract requires.
function getServerSnapshot(): ToastItem | null {
  return null;
}

/** Mount exactly once, in the root layout. */
export function Toaster() {
  const toast = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(dismissToast, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-50 flex justify-center px-5"
    >
      {toast === null ? null : (
        <div
          key={toast.id}
          className="animate-fade-in relative flex max-w-md items-center rounded-button border border-border bg-surface-raised px-4 py-3 text-sm text-ink shadow-lg"
        >
          {toast.withRingPulse ? (
            <span
              aria-hidden="true"
              className="animate-ring-pulse pointer-events-none absolute inset-0 rounded-button border-2 border-accent"
            />
          ) : null}
          <span className="relative">{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default Toaster;
