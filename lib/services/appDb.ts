import { createDb, type QuitDb } from '@/lib/persistence/db';
import { createRepositories } from '@/lib/persistence/dexieRepositories';
import type { Repositories } from '@/lib/persistence/repositories';

// Browser-only singleton. Deliberately NOT constructed at module scope —
// `getAppRepositories()` must only ever be called from an effect or event
// handler, never from render, so this stays `null` until the first such
// call on the client.
let instance: { db: QuitDb; repos: Repositories } | null = null;

/**
 * Lazily creates (once) and returns the app's default `QuitDb` repositories.
 * Throws outside a browser environment (no `indexedDB`) — callers (e.g.
 * `AppDataProvider`) must guard for that rather than call this during
 * server-side rendering.
 */
export function getAppRepositories(): Repositories {
  if (typeof indexedDB === 'undefined') {
    throw new Error(
      'getAppRepositories() requires a browser environment with IndexedDB support.'
    );
  }
  if (!instance) {
    const db = createDb();
    instance = { db, repos: createRepositories(db) };
  }
  return instance.repos;
}
