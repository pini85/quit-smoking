'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { DataStore } from '@/lib/services/dataStore';
import { getAppRepositories } from '@/lib/services/appDb';
import { AppDataContext, SERVER_STORE } from '@/lib/hooks/useAppData';

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
 * `useState` initializer, guarded by `typeof indexedDB !== 'undefined'`:
 * on the server that guard is false (no `indexedDB` in Node), so `store`
 * is `SERVER_STORE` — `AppDataContext`'s inert default (see
 * `useAppData.ts`) — never a `DataStore` that would try to touch a
 * nonexistent `indexedDB`. On the client the guard is true on the very
 * first render, so the real store exists from the first paint onward.
 * (A `useRef` lazy-init here — reading/writing `.current` during render —
 * is exactly what `eslint-plugin-react-hooks`'s `react-hooks/refs` rule
 * forbids under the React Compiler, so `useState`'s lazy initializer is
 * the compiler-safe equivalent: it also runs its callback at most once.)
 * The actual asynchronous read (`store.load()`) always happens in the
 * effect below, never during render.
 */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [store] = useState<DataStore>(() =>
    typeof indexedDB !== 'undefined' ? new DataStore(getAppRepositories()) : SERVER_STORE
  );

  useEffect(() => {
    void store.load();
  }, [store]);

  return <AppDataContext.Provider value={store}>{children}</AppDataContext.Provider>;
}
