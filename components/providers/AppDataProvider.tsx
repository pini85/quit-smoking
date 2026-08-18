'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { DataStore } from '@/lib/services/dataStore';
import { getAppRepositories } from '@/lib/services/appDb';
import { AppDataContext, SERVER_STORE, createInertRepositories } from '@/lib/hooks/useAppData';

/**
 * Creates the app's single `DataStore` and makes it available to
 * `useAppData()`. This is the only place `getAppRepositories()` (and so,
 * transitively, `indexedDB`) is touched outside of `lib/services/appDb.ts`
 * itself.
 *
 * SSG-prerender safety: this component always renders `children`
 * immediately — never a loading branch of its own — so the static
 * prerendered HTML is exactly the same skeleton markup a browser sees
 * before hydration. The `DataStore` instance is created once via a lazy
 * `useState` initializer, which distinguishes two different "no real store
 * yet" cases:
 *   - True server render (`typeof window === 'undefined'`, e.g. static
 *     prerendering in Node): expected, not an error. `store` is
 *     `SERVER_STORE`, `AppDataContext`'s designated server placeholder (see
 *     `useAppData.ts`) — never a `DataStore` that would try to touch a
 *     nonexistent `indexedDB`.
 *   - Client, but `indexedDB` itself is unavailable (e.g. some private
 *     browsing modes): a genuine anomaly worth flagging, so `store` is its
 *     own inert stub with a message naming the real cause, distinct from
 *     "this is a server render."
 * Otherwise (client with `indexedDB` available) the guard passes on the
 * very first render, so the real store exists from the first paint onward.
 * (A `useRef` lazy-init here — reading/writing `.current` during render —
 * is exactly what `eslint-plugin-react-hooks`'s `react-hooks/refs` rule
 * forbids under the React Compiler, so `useState`'s lazy initializer is
 * the compiler-safe equivalent: it also runs its callback at most once.)
 * The actual asynchronous read (`store.load()`) always happens in the
 * effect below, never during render.
 */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [store] = useState<DataStore>(() => {
    if (typeof window === 'undefined') {
      // Expected during static prerendering — not an error.
      return SERVER_STORE;
    }
    if (typeof indexedDB === 'undefined') {
      return new DataStore(
        createInertRepositories('IndexedDB is unavailable in this environment.')
      );
    }
    return new DataStore(getAppRepositories());
  });

  useEffect(() => {
    // A rejection here (e.g. IndexedDB blocked/quota/version-conflict)
    // must not escape as an unhandled promise rejection — that would leave
    // the app silently stuck showing `status: 'loading'` forever with no
    // diagnostic. Surfacing it as a proper `'error'` status on `AppData`
    // is deferred to a follow-up task; for now, log it so it's at least
    // visible.
    store.load().catch((err: unknown) => {
      console.error('Unsmoke: failed to load app data', err);
    });
  }, [store]);

  return <AppDataContext.Provider value={store}>{children}</AppDataContext.Provider>;
}
