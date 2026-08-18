'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * A single `localStorage` string, read reactively.
 *
 * `localStorage` is an external system, so it is subscribed to rather than
 * copied into state in an effect (which would cascade a second render and is
 * flagged by `react-hooks/set-state-in-effect`). Writes go through `set`, which
 * notifies this tab's subscribers; the `storage` event covers other tabs.
 *
 * The value is `undefined` until it has actually been read — distinct from
 * `null` ("read, and nothing stored"). During server render/hydration the
 * snapshot is `undefined`, so a consumer can render nothing rather than
 * flashing the not-yet-dismissed state and then hiding it a tick later.
 *
 * Only tiny throwaway UI preferences belong here. Real user data lives in
 * IndexedDB behind `DataStore`.
 */

const listeners = new Map<string, Set<() => void>>();

function notify(key: string): void {
  const forKey = listeners.get(key);
  if (!forKey) return;
  for (const listener of forKey) listener();
}

let storageHandlerInstalled = false;

function installStorageHandler(): void {
  if (storageHandlerInstalled || typeof window === 'undefined') return;
  storageHandlerInstalled = true;
  window.addEventListener('storage', (event) => {
    // `event.key` is null when the whole store was cleared — refresh everything.
    if (event.key === null) {
      for (const key of listeners.keys()) notify(key);
    } else {
      notify(event.key);
    }
  });
}

// Session-only fallback for browsers where `localStorage` throws (private
// mode, storage blocked): a dismissal must at least stick until reload
// instead of silently doing nothing.
const memory = new Map<string, string>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function getServerSnapshot(): undefined {
  return undefined;
}

export function useLocalPref(key: string): {
  value: string | null | undefined;
  set: (value: string) => void;
} {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      installStorageHandler();
      let forKey = listeners.get(key);
      if (!forKey) {
        forKey = new Set();
        listeners.set(key, forKey);
      }
      forKey.add(onStoreChange);
      return () => {
        const current = listeners.get(key);
        if (!current) return;
        current.delete(onStoreChange);
        if (current.size === 0) listeners.delete(key);
      };
    },
    [key]
  );

  // Strings compare by value under `Object.is`, so re-reading storage on every
  // call still satisfies the stable-snapshot contract.
  const getSnapshot = useCallback(() => read(key), [key]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const set = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        memory.set(key, next);
      }
      notify(key);
    },
    [key]
  );

  return { value, set };
}

export default useLocalPref;
