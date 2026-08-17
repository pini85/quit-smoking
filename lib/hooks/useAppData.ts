'use client';

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { DataStore, type AppData } from '@/lib/services/dataStore';
import type { Repositories } from '@/lib/persistence/repositories';

// A `Repositories` that throws the given message the moment any method on
// it is touched. Used as the constructor argument for inert `DataStore`s
// that structurally need *something* typed as `Repositories` but must never
// actually read or write. Exported so `AppDataProvider` can build its own
// inert store (with a message tailored to *why* there's no real store yet)
// for the "client, but IndexedDB unavailable" case, distinct from the
// true-server-render case below.
export function createInertRepositories(message: string): Repositories {
  return new Proxy({} as Repositories, {
    get(): never {
      throw new Error(message);
    },
  });
}

// Module constant: a `DataStore` that is permanently in the `loading` state
// and can never read/write real data. Used for the *true* server-render
// case (no `window` at all, e.g. static prerendering in Node) — never for
// "client but IndexedDB unavailable", which gets its own inert store with a
// more accurate message (see `AppDataProvider`). Its methods are never
// actually invoked during prerendering (only effects/handlers call
// `DataStore` write methods, and neither runs during SSR); if that
// invariant is ever violated, this throws loudly instead of doing nothing.
export const SERVER_STORE = new DataStore(
  createInertRepositories(
    'Server-side DataStore has no real repositories. DataStore methods ' +
      'must only be called from effects or event handlers, never during render.'
  )
);

// `null` means "no `AppDataProvider` ancestor" — `useAppData()` throws in
// that case (see below) rather than silently handing back an inert store,
// so a missing provider fails loudly instead of quietly never loading data.
export const AppDataContext = createContext<DataStore | null>(null);

// Stable module-constant reference — required by the `useSyncExternalStore`
// server-snapshot contract (see `lib/hooks/useNow.ts` for the same pattern).
// Matches the shape `DataStore`'s own initial snapshot starts in.
const SERVER_SNAPSHOT: AppData = {
  status: 'loading',
  profile: null,
  cravings: [],
  achievementUnlocks: [],
  reasons: [],
  preferences: null,
};

function getServerSnapshot(): AppData {
  return SERVER_SNAPSHOT;
}

export function useAppData(): { data: AppData; store: DataStore } {
  const store = useContext(AppDataContext);
  if (store === null) {
    throw new Error('useAppData must be used within <AppDataProvider>');
  }

  // Bind subscribe/getSnapshot to this render's `store` but keep their
  // identities stable across re-renders (as long as `store` itself doesn't
  // change) so `useSyncExternalStore` doesn't needlessly resubscribe.
  const subscribe = useCallback((onStoreChange: () => void) => store.subscribe(onStoreChange), [
    store,
  ]);
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);

  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { data, store };
}
