'use client';

import { useSyncExternalStore } from 'react';

/**
 * Reactive `prefers-reduced-motion: reduce`.
 *
 * `globals.css` already zeroes every duration under the media query, which
 * covers anything CSS can express. This hook exists for the cases CSS cannot
 * reach: a runner whose *content* has to change (a moving wave becomes a
 * still one, a breathing ring becomes a spoken countdown) rather than merely
 * animating more slowly.
 *
 * Server snapshot is `false` — no media queries exist during prerendering,
 * and a stable value is required by the `useSyncExternalStore` contract. The
 * real value lands on the first client commit.
 */

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default useReducedMotion;
