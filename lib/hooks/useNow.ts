'use client';

import { useMemo, useSyncExternalStore } from 'react';

/**
 * Module-level timer registry, keyed by interval length in ms, so multiple
 * `useNow(1000)` consumers across the tree share a single `setTimeout`
 * chain instead of each running their own clock.
 */
interface RegistryEntry {
  listeners: Set<() => void>;
  current: Date;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

const registry = new Map<number, RegistryEntry>();

// A single fixed, module-constant Date used as the server snapshot for every
// interval. Must never change identity — `useSyncExternalStore` requires a
// stable reference during the SSR/hydration render, and a real wall-clock
// value here would immediately mismatch and could loop. The first client
// tick (or the visibilitychange handler) corrects it right after mount.
const SERVER_SNAPSHOT = new Date(0);

function scheduleTick(intervalMs: number, entry: RegistryEntry): void {
  // Boundary-aligned so ticks land on multiples of intervalMs (no drift from
  // chaining fixed-delay timeouts).
  const delay = intervalMs - (Date.now() % intervalMs);
  entry.timeoutId = setTimeout(() => {
    entry.current = new Date();
    for (const listener of entry.listeners) {
      listener();
    }
    scheduleTick(intervalMs, entry);
  }, delay);
}

function subscribe(intervalMs: number, onStoreChange: () => void): () => void {
  let entry = registry.get(intervalMs);
  if (!entry) {
    entry = { listeners: new Set(), current: new Date(), timeoutId: null };
    registry.set(intervalMs, entry);
  }
  entry.listeners.add(onStoreChange);
  if (entry.timeoutId === null) {
    scheduleTick(intervalMs, entry);
  }

  return () => {
    const current = registry.get(intervalMs);
    if (!current) return;
    current.listeners.delete(onStoreChange);
    if (current.listeners.size === 0) {
      // Last listener for this interval gone: stop the timer and drop the
      // entry entirely so a later subscriber starts from a fresh `Date`
      // instead of an arbitrarily stale cached one.
      if (current.timeoutId !== null) {
        clearTimeout(current.timeoutId);
      }
      registry.delete(intervalMs);
    }
  };
}

function getSnapshot(intervalMs: number): Date {
  return registry.get(intervalMs)?.current ?? SERVER_SNAPSHOT;
}

function getServerSnapshot(): Date {
  return SERVER_SNAPSHOT;
}

let visibilityHandlerInstalled = false;

function installVisibilityHandler(): void {
  if (visibilityHandlerInstalled || typeof document === 'undefined') return;
  visibilityHandlerInstalled = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // Critical for correctness right after phone unlock: browsers throttle
    // or fully suspend timers in background tabs, so the chained
    // `setTimeout` may be arbitrarily late. On becoming visible again, push
    // a fresh `Date` to every interval's listeners immediately, then
    // re-align that interval's own timer to the new tick boundary so it
    // doesn't double-fire right on top of this update.
    const now = new Date();
    for (const [intervalMs, entry] of registry) {
      entry.current = now;
      for (const listener of entry.listeners) {
        listener();
      }
      if (entry.timeoutId !== null) {
        clearTimeout(entry.timeoutId);
        scheduleTick(intervalMs, entry);
      }
    }
  });
}

/** Reactive current time, ticking every `intervalMs` (default 1000ms). */
export function useNow(intervalMs = 1000): Date {
  const boundSubscribe = useMemo(
    () => (onStoreChange: () => void) => {
      installVisibilityHandler();
      return subscribe(intervalMs, onStoreChange);
    },
    [intervalMs]
  );
  const boundGetSnapshot = useMemo(() => () => getSnapshot(intervalMs), [intervalMs]);

  return useSyncExternalStore(boundSubscribe, boundGetSnapshot, getServerSnapshot);
}
