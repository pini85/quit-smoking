/**
 * Thin Capacitor platform shim. `@capacitor/core` is safe to import
 * statically — it works (and answers 'web'/false) in a plain browser too,
 * so this file needs no dynamic import or SSR guard. `@capacitor/app` below
 * is also imported statically — merely importing its module is harmless off
 * native; `onAppResume` itself is what guards against ever touching it
 * there.
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isNativeAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Subscribes to the native app's `resume` event (foregrounding from the
 * background or the lock screen) — a no-op off native, since neither a
 * plain browser nor prerender ever fires it. Returns an unsubscribe
 * function; safe to call even before the async listener handle has actually
 * attached (it is removed immediately once it resolves if the caller has
 * already unsubscribed by then).
 */
export function onAppResume(callback: () => void): () => void {
  if (!isNativePlatform()) return () => {};

  let cancelled = false;
  let handle: { remove: () => Promise<void> } | null = null;

  void App.addListener('resume', callback).then((h) => {
    if (cancelled) {
      void h.remove();
    } else {
      handle = h;
    }
  });

  return () => {
    cancelled = true;
    if (handle) void handle.remove();
  };
}
