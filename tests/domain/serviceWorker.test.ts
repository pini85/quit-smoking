import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderServiceWorker } from '@/scripts/generate-sw.mjs';

/**
 * Runs the real `lib/service-worker.js` template — rendered exactly the way
 * `pnpm build` renders it — inside a hand-rolled fake ServiceWorkerGlobalScope.
 *
 * Offline is a product promise, not an optimisation: someone mid-craving on a
 * dead phone plan has to be able to open the app and navigate it. Nothing else
 * in the suite can catch a regression there, and a browser cannot be part of
 * `pnpm test`, so the worker gets driven directly.
 */

const ORIGIN = 'https://unsmoke.test';
const TEMPLATE = path.join(process.cwd(), 'lib', 'service-worker.js');

/** A precache list shaped like a real `out/`, small enough to reason about. */
const MANIFEST = [
  '/404.html',
  '/_next/static/chunks/abc123.js',
  '/_next/static/chunks/abc123.css',
  '/craving.html',
  '/health.html',
  '/health/lungs.html',
  '/icons/icon-192.png',
  '/index.html',
  '/index.txt',
  '/manifest.webmanifest',
  '/progress.html',
  '/progress.txt',
  '/you.html',
];

type StoredBody = { status: number; body: string };

function makeResponse(url: string, status: number, body: string, type = 'basic'): Response {
  const res = new Response(body, { status });
  Object.defineProperty(res, 'type', { value: type });
  Object.defineProperty(res, 'url', { value: url });
  return res;
}

function absolute(url: string): string {
  return new URL(url, ORIGIN).href;
}

/** The Cache API stores bytes, so a match is replayable — a stored `Response` would not be. */
class FakeCache {
  readonly store = new Map<string, StoredBody>();

  async put(request: Request | string, response: Response): Promise<void> {
    const key = typeof request === 'string' ? absolute(request) : request.url;
    this.store.set(key, { status: response.status, body: await response.text() });
  }

  async match(request: Request | string): Promise<Response | undefined> {
    const key = typeof request === 'string' ? absolute(request) : request.url;
    const entry = this.store.get(key);
    return entry ? makeResponse(key, entry.status, entry.body) : undefined;
  }

  async addAll(urls: string[]): Promise<void> {
    for (const url of urls) {
      const response = await harness.fetch(absolute(url));
      if (!response.ok) throw new Error(`addAll failed for ${url}: ${response.status}`);
      await this.put(absolute(url), response);
    }
  }
}

class FakeCacheStorage {
  readonly caches = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    const existing = this.caches.get(name);
    if (existing) return existing;
    const created = new FakeCache();
    this.caches.set(name, created);
    return created;
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }
}

type Harness = {
  cacheStorage: FakeCacheStorage;
  listeners: Map<string, (event: Record<string, unknown>) => void>;
  origin: Map<string, { status: number; body: string; type?: string }>;
  networkLog: string[];
  online: boolean;
  skipWaitingCalls: number;
  claimCalls: number;
  fetch: (input: Request | string) => Promise<Response>;
};

let harness: Harness;

function boot(): void {
  const cacheStorage = new FakeCacheStorage();
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const origin = new Map<string, { status: number; body: string; type?: string }>();
  const networkLog: string[] = [];

  harness = {
    cacheStorage,
    listeners,
    origin,
    networkLog,
    online: true,
    skipWaitingCalls: 0,
    claimCalls: 0,
    fetch(input) {
      const url = typeof input === 'string' ? absolute(input) : input.url;
      networkLog.push(url);
      if (!harness.online) return Promise.reject(new TypeError('Failed to fetch'));
      const hit = origin.get(url);
      if (!hit) return Promise.resolve(makeResponse(url, 404, 'not found'));
      return Promise.resolve(makeResponse(url, hit.status, hit.body, hit.type));
    },
  };

  // Serve every precached URL from the fake origin, body tagged with its path
  // so assertions can tell exactly which entry answered.
  for (const url of MANIFEST) origin.set(absolute(url), { status: 200, body: `body:${url}` });

  const self: Record<string, unknown> = {
    location: new URL('/sw.js', ORIGIN),
    addEventListener: (type: string, fn: (event: Record<string, unknown>) => void) =>
      listeners.set(type, fn),
    skipWaiting: () => {
      harness.skipWaitingCalls += 1;
    },
    clients: {
      claim: async () => {
        harness.claimCalls += 1;
      },
    },
  };

  const source = renderServiceWorker(readFileSync(TEMPLATE, 'utf8'), MANIFEST, 'abc123def456');
  vm.runInNewContext(source, {
    self,
    caches: cacheStorage,
    fetch: (input: Request | string) => harness.fetch(input),
    Response,
    Request,
    URL,
    Set,
    Promise,
    TypeError,
    console,
  });
}

/** Dispatches an event and settles whatever the handler passed to waitUntil/respondWith. */
async function dispatch(
  type: string,
  event: Record<string, unknown> = {}
): Promise<Response | undefined> {
  const pending: Promise<unknown>[] = [];
  const responses: Promise<Response>[] = [];

  const handler = harness.listeners.get(type);
  if (!handler) throw new Error(`no ${type} listener registered`);

  handler({
    ...event,
    waitUntil: (p: Promise<unknown>) => pending.push(p),
    respondWith: (p: Promise<Response>) => responses.push(p),
  });

  await Promise.all(pending);
  return responses.length > 0 ? responses[0] : undefined;
}

function navigationRequest(pathname: string): Request {
  const request = new Request(absolute(pathname));
  Object.defineProperty(request, 'mode', { value: 'navigate' });
  return request;
}

async function navigate(pathname: string): Promise<string> {
  const response = await dispatch('fetch', { request: navigationRequest(pathname) });
  return response ? await response.text() : '<not intercepted>';
}

/** Background `cache.put`s are fire-and-forget; give the microtask queue a turn. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function currentCache(): Promise<FakeCache> {
  return harness.cacheStorage.open('unsmoke-abc123def456');
}

beforeEach(boot);

describe('install', () => {
  it('precaches the whole manifest into a version-named cache', async () => {
    await dispatch('install');
    expect(await harness.cacheStorage.keys()).toEqual(['unsmoke-abc123def456']);
    expect((await currentCache()).store.size).toBe(MANIFEST.length);
  });

  it('never calls skipWaiting on its own — a live craving session must not be reloaded', async () => {
    await dispatch('install');
    expect(harness.skipWaitingCalls).toBe(0);
  });
});

describe('activate', () => {
  beforeEach(async () => {
    await dispatch('install');
  });

  it('deletes caches from previous versions but leaves other apps alone', async () => {
    await harness.cacheStorage.open('unsmoke-deadbeefcafe');
    await harness.cacheStorage.open('some-other-app');

    await dispatch('activate');

    const remaining = await harness.cacheStorage.keys();
    expect(remaining).toContain('unsmoke-abc123def456');
    expect(remaining).not.toContain('unsmoke-deadbeefcafe');
    expect(remaining).toContain('some-other-app');
  });

  it('claims open clients', async () => {
    await dispatch('activate');
    expect(harness.claimCalls).toBe(1);
  });
});

describe('offline navigation', () => {
  beforeEach(async () => {
    await dispatch('install');
    await dispatch('activate');
    harness.online = false;
    harness.networkLog.length = 0;
  });

  it.each([
    ['/', '/index.html'],
    ['/progress', '/progress.html'],
    ['/health', '/health.html'],
    ['/health/lungs', '/health/lungs.html'],
    ['/craving', '/craving.html'],
    ['/you', '/you.html'],
  ])('serves %s from the precached %s', async (pathname, precached) => {
    expect(await navigate(pathname)).toBe(`body:${precached}`);
  });

  it('tolerates a trailing slash', async () => {
    expect(await navigate('/progress/')).toBe('body:/progress.html');
  });

  it('falls back to the app shell for a route the build never emitted', async () => {
    expect(await navigate('/deep/link/that/never/existed')).toBe('body:/index.html');
  });

  it('answers navigations without touching the network at all', async () => {
    await navigate('/');
    await navigate('/health/lungs');
    expect(harness.networkLog).toEqual([]);
  });

  it('serves hashed _next/static assets from cache', async () => {
    const response = await dispatch('fetch', {
      request: new Request(absolute('/_next/static/chunks/abc123.js')),
    });
    expect(await response?.text()).toBe('body:/_next/static/chunks/abc123.js');
    expect(harness.networkLog).toEqual([]);
  });

  it('serves the RSC payloads that soft navigations depend on', async () => {
    const response = await dispatch('fetch', { request: new Request(absolute('/progress.txt')) });
    expect(await response?.text()).toBe('body:/progress.txt');
  });
});

describe('cache hygiene', () => {
  beforeEach(async () => {
    await dispatch('install');
    await dispatch('activate');
  });

  it('passes a 500 through without caching it', async () => {
    const url = absolute('/late-addition');
    harness.origin.set(url, { status: 500, body: 'boom' });

    const response = await dispatch('fetch', { request: new Request(url) });
    expect(response?.status).toBe(500);

    await settle();
    expect((await currentCache()).store.has(url)).toBe(false);
  });

  it('does not cache opaque cross-origin-ish responses', async () => {
    const url = absolute('/opaque');
    harness.origin.set(url, { status: 200, body: 'x', type: 'opaque' });

    await dispatch('fetch', { request: new Request(url) });

    await settle();
    expect((await currentCache()).store.has(url)).toBe(false);
  });

  it('caches a fresh 200 so the next visit has it offline', async () => {
    const url = absolute('/fresh');
    harness.origin.set(url, { status: 200, body: 'fresh' });

    await dispatch('fetch', { request: new Request(url) });

    await settle();
    expect((await currentCache()).store.has(url)).toBe(true);
  });

  it('serves stale-while-revalidate: cache first, refresh behind it', async () => {
    const url = absolute('/manifest.webmanifest');
    harness.origin.set(url, { status: 200, body: 'updated manifest' });
    harness.networkLog.length = 0;

    const response = await dispatch('fetch', { request: new Request(url) });
    expect(await response?.text()).toBe('body:/manifest.webmanifest');
    expect(harness.networkLog).toContain(url);

    await settle();
    expect((await currentCache()).store.get(url)?.body).toBe('updated manifest');
  });
});

describe('request filtering', () => {
  beforeEach(async () => {
    await dispatch('install');
    await dispatch('activate');
  });

  it('ignores cross-origin requests entirely', async () => {
    expect(await dispatch('fetch', { request: new Request('https://example.com/x') })).toBeUndefined();
  });

  it('ignores non-GET requests', async () => {
    const request = new Request(absolute('/'), { method: 'POST' });
    expect(await dispatch('fetch', { request })).toBeUndefined();
  });
});

describe('SKIP_WAITING', () => {
  it('activates only when the UI explicitly asks', async () => {
    await dispatch('install');

    harness.listeners.get('message')?.({ data: { type: 'SOMETHING_ELSE' } });
    expect(harness.skipWaitingCalls).toBe(0);

    harness.listeners.get('message')?.({ data: { type: 'SKIP_WAITING' } });
    expect(harness.skipWaitingCalls).toBe(1);
  });

  it('survives a message with no data', async () => {
    await dispatch('install');
    expect(() => harness.listeners.get('message')?.({ data: null })).not.toThrow();
  });
});
