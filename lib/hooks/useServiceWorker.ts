'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseServiceWorkerResult {
  /** True once a newer worker is installed and parked in `waiting`. */
  updateReady: boolean;
  /** Activates the waiting worker and reloads onto it. No-op if none waits. */
  applyUpdate: () => void;
}

/**
 * Registers `/sw.js` and surfaces the one moment the user needs to know about:
 * a new version is downloaded and waiting.
 *
 * Deliberately *not* auto-activating. `sw.js` never calls `skipWaiting()` on
 * its own, because swapping the controller mid-session would reload the page —
 * and this app's whole point is the screen someone is staring at while riding
 * out a craving. The new version waits until it is explicitly asked for.
 *
 * Registration is production-only: in `next dev` a worker would serve stale
 * chunks over the top of HMR and make every change look like it did nothing.
 */
export function useServiceWorker(): UseServiceWorkerResult {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  // A `controllerchange` fires once per activation, but a pathological worker
  // could activate repeatedly; reloading more than once would be a loop.
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const container = navigator.serviceWorker;
    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    // On a first-ever visit the page loads uncontrolled, then the brand-new
    // worker calls `clients.claim()` — which fires `controllerchange` even
    // though nothing was updated. Reloading there would bounce every new
    // visitor for no reason, so only a page that was ALREADY controlled
    // reloads (which is exactly the case `applyUpdate` can produce).
    const wasControlled = container.controller !== null;

    /** A worker only counts as an *update* if something is already controlling us. */
    function considerWorker(worker: ServiceWorker | null) {
      if (!worker || cancelled || !container.controller) return;
      if (worker.state === 'installed') setWaiting(worker);
    }

    function onUpdateFound() {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => considerWorker(installing));
      considerWorker(installing);
    }

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      // Cheap: the browser 304s an unchanged sw.js. Catches the case where the
      // app has been open (or backgrounded on a phone) across a deploy.
      void registration?.update();
    }

    function onControllerChange() {
      if (!wasControlled || reloadedRef.current) return;
      reloadedRef.current = true;
      window.location.reload();
    }

    container.addEventListener('controllerchange', onControllerChange);

    void container
      .register('/sw.js')
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        // A worker may already be parked from a previous visit.
        if (reg.waiting && container.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', onUpdateFound);
        document.addEventListener('visibilitychange', onVisibilityChange);
      })
      .catch((error: unknown) => {
        console.error('Unsmoke: service worker registration failed', error);
      });

    return () => {
      cancelled = true;
      container.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      registration?.removeEventListener('updatefound', onUpdateFound);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    // The reload happens in `controllerchange`, once the new worker is in
    // charge — reloading here would just re-run the old version.
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [waiting]);

  return { updateReady: waiting !== null, applyUpdate };
}

export default useServiceWorker;
