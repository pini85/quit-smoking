/**
 * Unsmoke service worker — TEMPLATE, not a shipped file.
 *
 * `scripts/generate-sw.mjs` runs after `next build` and rewrites two exact
 * substrings before writing the result to `out/sw.js`: the manifest
 * placeholder becomes a literal JSON array of URLs, and the cache-version
 * placeholder becomes a content hash of that whole list. Both replacements are
 * plain string matches that the script asserts occur exactly once, so keep the
 * two initialisers below spelled exactly as they are.
 *
 * Offline is a product promise here, not an optimisation: the craving flow has
 * to work on a plane, in a basement, on a dead phone plan. So every route's
 * HTML plus the whole `_next/static` bundle is precached up front at install,
 * and navigations are served cache-first.
 *
 * @typedef {ServiceWorkerGlobalScope & typeof globalThis} SWScope
 */

/** @type {string[]} */
const PRECACHE_MANIFEST = self.__PRECACHE_MANIFEST || [];

/** Content-derived, so a new build is always a new cache. */
const CACHE_VERSION = '__CACHE_VERSION__';
const CACHE_NAME = `unsmoke-${CACHE_VERSION}`;

/** Fast membership tests for the navigation lookups below. */
const PRECACHED = new Set(PRECACHE_MANIFEST);

const OFFLINE_FALLBACK = '/index.html';

/** Next's cache-busting query param, appended to every RSC fetch. */
const RSC_QUERY = '_rsc';

/**
 * The App Router's RSC payloads. Split out from the critical set because they
 * are the long tail (~108 of ~176 entries) and `cache.addAll` is
 * all-or-nothing: one edge 404 among them would reject the whole install and
 * leave the user with no offline app at all.
 */
const RSC_PRECACHE = PRECACHE_MANIFEST.filter((url) => url.endsWith('.txt'));

/** Everything the app cannot open without: route HTML, JS/CSS/fonts, icons, manifest. */
const CRITICAL_PRECACHE = PRECACHE_MANIFEST.filter((url) => !url.endsWith('.txt'));

/**
 * Is this the router asking for an RSC payload? Next appends `?_rsc=<hash>` to
 * every such fetch (see `setCacheBustingSearchParam`), so the runtime URL never
 * equals the precache key and these have to be matched with `ignoreSearch`.
 * @param {URL} url
 * @returns {boolean}
 */
function isRscRequest(url) {
  return url.pathname.endsWith('.txt') || url.searchParams.has(RSC_QUERY);
}

/**
 * Candidate precache keys for a navigation to `pathname`, most specific first.
 * A static export emits `/index.html` for `/` and `/progress.html` for
 * `/progress`, but a trailing-slash config would emit `/progress/index.html`
 * instead — so try every shape and let `PRECACHED` decide.
 * @param {string} pathname
 * @returns {string[]}
 */
function navigationCandidates(pathname) {
  const clean = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;

  if (clean === '/') return [OFFLINE_FALLBACK, '/'];
  return [clean, `${clean}.html`, `${clean}/index.html`];
}

/**
 * The precached HTML for `pathname`, or `undefined` if this build never
 * emitted that route. Deliberately does NOT fall back to the app shell: an
 * online request for an unknown path has to reach the network so the host's
 * real 404 is what the user sees. The shell is the *offline* last resort only,
 * applied by the caller.
 * @param {Cache} cache
 * @param {string} pathname
 * @returns {Promise<Response | undefined>}
 */
async function matchNavigation(cache, pathname) {
  for (const candidate of navigationCandidates(pathname)) {
    if (!PRECACHED.has(candidate)) continue;
    const hit = await cache.match(candidate);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Only ever store responses we can actually replay. Opaque cross-origin
 * responses and any non-2xx (404 HTML, a captive-portal redirect, a 5xx) would
 * poison the cache for the life of the version.
 * @param {Response | undefined} response
 * @returns {boolean}
 */
function isCacheable(response) {
  return Boolean(response && response.ok && response.type === 'basic');
}

self.addEventListener('install', (event) => {
  // No skipWaiting: a live craving session must not have the page swapped out
  // from under it. The new worker waits until the UI asks (SKIP_WAITING).
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // All-or-nothing on purpose: a half-populated critical set is worse than
      // no worker, because the app would look installed and then break.
      await cache.addAll(CRITICAL_PRECACHE);

      // Best-effort. Missing an RSC payload costs a soft navigation its
      // instant transition (the router falls back to a full page load, which
      // the navigation handler still serves from cache) — it must never cost
      // the whole install.
      await Promise.all(
        RSC_PRECACHE.map(async (url) => {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn('Unsmoke SW: skipped optional RSC payload', url, error);
          }
        })
      );
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('unsmoke-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await matchNavigation(cache, url.pathname);
        if (cached) return cached;

        try {
          return await fetch(request);
        } catch {
          const fallback = await cache.match(OFFLINE_FALLBACK);
          if (fallback) return fallback;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Hashed build output: the URL changes whenever the bytes do, so a hit is
  // always correct and never needs revalidating.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (isCacheable(response)) await cache.put(request, response.clone());
        return response;
      })()
    );
    return;
  }

  // RSC payloads. Cache-first with `ignoreSearch`, because the router appends
  // a `?_rsc=<hash>` cache-buster that changes per navigation state and would
  // miss the precache key on every single request. Like `_next/static` these
  // are immutable for the life of a deploy — a new deploy means a new cache
  // name — so there is nothing to revalidate.
  if (isRscRequest(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;

        try {
          const response = await fetch(request);
          // Store under the bare pathname, never the `_rsc`-stamped URL, so
          // the cache holds one entry per route instead of one per visit.
          if (isCacheable(response)) await cache.put(url.pathname, response.clone());
          return response;
        } catch {
          // Offline with no payload: a 503 makes the router fall back to a
          // full page load, which the navigation handler serves from cache.
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Everything else same-origin: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);

      const network = fetch(request)
        .then(async (response) => {
          if (isCacheable(response)) await cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);

      if (cached) {
        // Refresh in the background; failures here are expected offline.
        event.waitUntil(network);
        return cached;
      }

      const response = await network;
      if (response) return response;
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
