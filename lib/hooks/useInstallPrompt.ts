'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type InstallPlatform = 'android' | 'ios' | 'other';

/** Not in the DOM lib yet in most TS configs — the standard shape is stable. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface UseInstallPromptResult {
  /** Coarse OS guess from the user agent — only used to pick which copy to show. */
  platform: InstallPlatform;
  /** True when the app is already running as an installed/standalone PWA. */
  isStandalone: boolean;
  /** True once the browser has fired `beforeinstallprompt` (Android/desktop Chrome). */
  canPromptInstall: boolean;
  /** Shows the captured native prompt. Resolves 'unavailable' if none was captured. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

function detectStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    nav.standalone === true
  );
}

// `platform`/`isStandalone` never change over a page's lifetime, so these
// two stores need no real subscription — just an SSR-safe way to defer
// reading `navigator`/`window` until the client's own render pass (see the
// server-snapshot doc below).
function noopSubscribe(): () => void {
  return () => {};
}

function getPlatformSnapshot(): InstallPlatform {
  return detectPlatform();
}
function getPlatformServerSnapshot(): InstallPlatform {
  return 'other';
}

function getStandaloneSnapshot(): boolean {
  return detectStandalone();
}
function getStandaloneServerSnapshot(): boolean {
  return false;
}

// The captured `beforeinstallprompt` event IS a genuine external system —
// module-level so every hook instance shares the one prompt the browser
// ever gives out, mirroring `Toast`'s module-level store.
let capturedEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let listenerInstalled = false;

function notify(): void {
  for (const listener of listeners) listener();
}

function installBeforeInstallPromptListener(): void {
  if (listenerInstalled || typeof window === 'undefined') return;
  listenerInstalled = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    // Stop Chrome's automatic mini-infobar — this card is the install UI.
    event.preventDefault();
    capturedEvent = event as BeforeInstallPromptEvent;
    notify();
  });
}

function subscribeToPrompt(onStoreChange: () => void): () => void {
  installBeforeInstallPromptListener();
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getPromptSnapshot(): BeforeInstallPromptEvent | null {
  return capturedEvent;
}
function getPromptServerSnapshot(): null {
  return null;
}

/**
 * Client-only bridge to the browser's install-prompt machinery. Uses the
 * same SSR-safe `useSyncExternalStore` shape as `useReducedMotion`/`useNow`
 * so this app's static export (`output: 'export'`) hydrates cleanly: every
 * value starts at its server snapshot (`'other'`, `false`, `null`) and only
 * reads the real browser globals once the client itself calls `getSnapshot`
 * — no `useEffect` + `setState` cascade, no hydration mismatch.
 *
 * No install-prompt library involved — just the two standard browser
 * signals (`beforeinstallprompt`, `display-mode: standalone`) plus a
 * user-agent sniff for iOS, which has no programmatic prompt at all and
 * only ever gets manual "Share -> Add to Home Screen" copy.
 */
export function useInstallPrompt(): UseInstallPromptResult {
  const platform = useSyncExternalStore(noopSubscribe, getPlatformSnapshot, getPlatformServerSnapshot);
  const isStandalone = useSyncExternalStore(
    noopSubscribe,
    getStandaloneSnapshot,
    getStandaloneServerSnapshot
  );
  const promptEvent = useSyncExternalStore(subscribeToPrompt, getPromptSnapshot, getPromptServerSnapshot);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!capturedEvent) return 'unavailable';
    await capturedEvent.prompt();
    const choice = await capturedEvent.userChoice;
    // A captured prompt can only ever be used once.
    capturedEvent = null;
    notify();
    return choice.outcome;
  }, []);

  return {
    platform,
    isStandalone,
    canPromptInstall: promptEvent !== null,
    promptInstall,
  };
}

export default useInstallPrompt;
