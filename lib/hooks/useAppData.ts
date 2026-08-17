'use client';

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { DataStore, type AppData } from '@/lib/services/dataStore';
import type { Repositories } from '@/lib/persistence/repositories';

// A `Repositories` that throws the moment any method on it is touched. Used
// only as the constructor argument for `SERVER_STORE` below — during
// server-side rendering / static prerendering there is no IndexedDB, so no
// real `Repositories` exists yet, but `DataStore` still needs *something*
// structurally typed as `Repositories` to construct. Its methods are never
// actually invoked during prerendering (only effects/handlers call
// `DataStore` write methods, and neither runs during SSR); if that
// invariant is ever violated, this throws loudly instead of doing nothing.
function createInertRepositories(): Repositories {
  return new Proxy({} as Repositories, {
    get(): never {
      throw new Error(
        'Server-side DataStore has no real repositories. DataStore methods ' +
          'must only be called from effects or event handlers, never during render.'
      );
    },
  });
}

// Module constant: a `DataStore` that is permanently in the `loading` state
// and can never read/write real data. This is both the context's default
// value (used if `useAppData` is ever called outside `AppDataProvider`) and
// the value `AppDataProvider` renders with on the server, where
// `getAppRepositories()` cannot run. Being a real `DataStore` (rather than
// `null`) keeps `useAppData`'s return type non-nullable while staying
// completely inert until a real store replaces it on the client.
// Exported so `AppDataProvider` can render it explicitly on the server
// (where no `DataStore` can exist yet) instead of relying on
// `createContext`'s default — that default only applies when there's no
// Provider in the tree at all, not when a Provider is present but has
// nothing to give it yet.
export const SERVER_STORE = new DataStore(createInertRepositories());

export const AppDataContext = createContext<DataStore>(SERVER_STORE);

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
