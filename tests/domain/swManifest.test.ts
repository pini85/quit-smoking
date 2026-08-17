import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildPrecacheList,
  computeCacheVersion,
  renderServiceWorker,
  shouldPrecache,
  toUrlPath,
} from '@/scripts/generate-sw.mjs';

/**
 * Mirrors the shape `next build` actually emits into `out/` (verified against a
 * real build): one HTML per route, RSC `.txt` payloads next to them, hashed
 * `_next/static` assets, the manifest, and the icons — plus the things that
 * must NOT be precached.
 */
const FIXTURE: Record<string, string> = {
  'index.html': '<!doctype html>home',
  'progress.html': '<!doctype html>progress',
  'health.html': '<!doctype html>health',
  'health/lungs.html': '<!doctype html>lungs',
  '404.html': '<!doctype html>404',
  'index.txt': 'rsc payload',
  'progress.txt': 'rsc payload',
  // Next's segment-cache payloads contain `$` in the filename.
  'health/lungs/__next.health.$d$category.__PAGE__.txt': 'segment payload',
  '_next/static/chunks/abc123.js': 'console.log(1)',
  '_next/static/chunks/abc123.css': 'body{}',
  '_next/static/media/font.woff2': 'font-bytes',
  'icons/icon-192.png': 'png-bytes',
  'icons/icon.svg': '<svg/>',
  'manifest.webmanifest': '{"name":"Unsmoke"}',
  'icon.svg': '<svg/>',
  // Must be excluded:
  'sw.js': '// a previous build of the worker',
  '_next/static/chunks/abc123.js.map': '{"version":3}',
  'next.svg': '<svg/>',
};

function writeFixture(root: string, files: Record<string, string>): void {
  for (const [relative, contents] of Object.entries(files)) {
    const file = path.join(root, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents, 'utf8');
  }
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'unsmoke-sw-'));
  writeFixture(dir, FIXTURE);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('buildPrecacheList', () => {
  it('precaches every route HTML, so a hard navigation works offline', () => {
    const urls = buildPrecacheList(dir);
    expect(urls).toEqual(
      expect.arrayContaining([
        '/index.html',
        '/progress.html',
        '/health.html',
        '/health/lungs.html',
        '/404.html',
      ])
    );
  });

  it('precaches the RSC payloads that soft navigations fetch', () => {
    const urls = buildPrecacheList(dir);
    expect(urls).toContain('/index.txt');
    expect(urls).toContain('/progress.txt');
  });

  it('precaches _next/static assets of every kind', () => {
    const urls = buildPrecacheList(dir);
    expect(urls).toEqual(
      expect.arrayContaining([
        '/_next/static/chunks/abc123.js',
        '/_next/static/chunks/abc123.css',
        '/_next/static/media/font.woff2',
      ])
    );
  });

  it('precaches the manifest and the icons', () => {
    const urls = buildPrecacheList(dir);
    expect(urls).toEqual(
      expect.arrayContaining([
        '/manifest.webmanifest',
        '/icon.svg',
        '/icons/icon-192.png',
        '/icons/icon.svg',
      ])
    );
  });

  it('excludes sw.js itself — a worker must never precache its own bytes', () => {
    expect(buildPrecacheList(dir)).not.toContain('/sw.js');
    expect(shouldPrecache('sw.js')).toBe(false);
  });

  it('excludes source maps and stray public assets no route references', () => {
    const urls = buildPrecacheList(dir);
    expect(urls).not.toContain('/_next/static/chunks/abc123.js.map');
    expect(urls).not.toContain('/next.svg');
  });

  it('returns a sorted list, so the output is stable across filesystems', () => {
    const urls = buildPrecacheList(dir);
    expect(urls).toEqual([...urls].sort());
  });

  it('leaves `$` unescaped so Next segment payloads match at runtime', () => {
    expect(toUrlPath('health/lungs/__next.health.$d$category.__PAGE__.txt')).toBe(
      '/health/lungs/__next.health.$d$category.__PAGE__.txt'
    );
    expect(buildPrecacheList(dir)).toContain(
      '/health/lungs/__next.health.$d$category.__PAGE__.txt'
    );
  });

  it('percent-encodes characters that would otherwise break the URL', () => {
    expect(toUrlPath('a file.txt')).toBe('/a%20file.txt');
    expect(toUrlPath('q?.txt')).toBe('/q%3F.txt');
    expect(toUrlPath('h#.txt')).toBe('/h%23.txt');
  });
});

describe('computeCacheVersion', () => {
  it('is deterministic for identical content', () => {
    const other = mkdtempSync(path.join(tmpdir(), 'unsmoke-sw-'));
    try {
      writeFixture(other, FIXTURE);
      const a = computeCacheVersion(dir, buildPrecacheList(dir));
      const b = computeCacheVersion(other, buildPrecacheList(other));
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{12}$/);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it('changes when a precached file’s content changes', () => {
    const before = computeCacheVersion(dir, buildPrecacheList(dir));
    writeFileSync(path.join(dir, '_next/static/chunks/abc123.js'), 'console.log(2)', 'utf8');
    expect(computeCacheVersion(dir, buildPrecacheList(dir))).not.toBe(before);
  });

  it('changes when a file is added to the precache list', () => {
    const before = computeCacheVersion(dir, buildPrecacheList(dir));
    writeFixture(dir, { 'health/heart.html': '<!doctype html>heart' });
    expect(computeCacheVersion(dir, buildPrecacheList(dir))).not.toBe(before);
  });

  it('ignores changes to files that are not precached', () => {
    const before = computeCacheVersion(dir, buildPrecacheList(dir));
    writeFileSync(path.join(dir, 'sw.js'), '// anything at all', 'utf8');
    expect(computeCacheVersion(dir, buildPrecacheList(dir))).toBe(before);
  });
});

describe('renderServiceWorker', () => {
  const template = [
    'const PRECACHE_MANIFEST = self.__PRECACHE_MANIFEST || [];',
    "const CACHE_VERSION = '__CACHE_VERSION__';",
  ].join('\n');

  it('substitutes both placeholders and leaves none behind', () => {
    const source = renderServiceWorker(template, ['/index.html'], 'abc123def456');
    expect(source).toContain('const PRECACHE_MANIFEST = ["/index.html"];');
    expect(source).toContain("const CACHE_VERSION = 'abc123def456';");
    expect(source).not.toContain('__PRECACHE_MANIFEST');
    expect(source).not.toContain('__CACHE_VERSION__');
  });

  it('throws rather than silently shipping a worker with no precache list', () => {
    expect(() => renderServiceWorker('// nothing to replace', [], 'abc123def456')).toThrow(
      /expected exactly 1 occurrence/
    );
  });
});
