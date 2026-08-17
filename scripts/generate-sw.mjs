// Postbuild step: turn `lib/service-worker.js` (a template) into `out/sw.js`
// with a real precache manifest and a content-derived cache version baked in.
//
// Runs as part of `pnpm build`, after `next build` has emitted `out/`. No
// dependencies — plain node, so it works anywhere the build works.
//
// Exported for `tests/domain/swManifest.test.ts`; the CLI entry point at the
// bottom only fires when this file is the process's main module.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'out');
const TEMPLATE = path.join(ROOT, 'lib', 'service-worker.js');

/** Exact substrings the template must contain; see its header comment. */
const MANIFEST_PLACEHOLDER = 'self.__PRECACHE_MANIFEST || []';
const VERSION_PLACEHOLDER = '__CACHE_VERSION__';

/**
 * Never precache the worker itself (it would cache its own stale bytes and
 * never update) or source maps (megabytes nobody reads offline).
 */
const EXCLUDED_FILES = new Set(['sw.js', '.DS_Store']);
const EXCLUDED_EXTENSIONS = new Set(['.map']);

/** Directories under `out/` whose entire contents are precached. */
const PRECACHED_DIRECTORIES = ['_next/static/', 'icons/'];

/** Individual root-level files that are precached by name. */
const PRECACHED_ROOT_FILES = new Set(['manifest.webmanifest', 'manifest.json', 'icon.svg']);

/**
 * Percent-encodes only what a URL path actually requires, so the precache key
 * is byte-identical to what the runtime will request. Naive
 * `encodeURIComponent` per segment would mangle the `$` in Next's segment
 * payload names (`__next.health.$d$category.__PAGE__.txt`) into `%24` and every
 * `cache.match` for them would miss.
 * @param {string} relative posix path relative to `out/`
 * @returns {string}
 */
export function toUrlPath(relative) {
  return `/${encodeURI(relative).replaceAll('#', '%23').replaceAll('?', '%3F')}`;
}

/**
 * Every file under `dir`, as posix-style paths relative to it, sorted so the
 * result is stable across filesystems (readdir order is not guaranteed).
 * @param {string} dir
 * @returns {string[]}
 */
export function listFiles(dir) {
  /** @type {string[]} */
  const found = [];

  /** @param {string} current @param {string} prefix */
  function walk(current, prefix) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(current, entry.name), relative);
      } else if (entry.isFile()) {
        found.push(relative);
      }
    }
  }

  walk(dir, '');
  return found.sort();
}

/**
 * Should this build artefact be served from the cache when offline?
 * @param {string} relative posix path relative to `out/`
 * @returns {boolean}
 */
export function shouldPrecache(relative) {
  const basename = path.posix.basename(relative);
  if (EXCLUDED_FILES.has(basename)) return false;
  if (EXCLUDED_EXTENSIONS.has(path.posix.extname(relative))) return false;

  // One HTML file per route, including the 20 health-category pages — these
  // are what makes an offline hard navigation possible at all.
  if (relative.endsWith('.html')) return true;

  // The App Router's RSC payloads (`/progress.txt`, `__next._tree.txt`, the
  // per-segment `__next.*.__PAGE__.txt` files). Soft navigations between tabs
  // fetch these, so without them an installed app would go offline-blank the
  // moment the user tapped a tab.
  if (relative.endsWith('.txt')) return true;

  if (PRECACHED_DIRECTORIES.some((prefix) => relative.startsWith(prefix))) return true;
  if (!relative.includes('/') && PRECACHED_ROOT_FILES.has(basename)) return true;

  return false;
}

/**
 * Absolute, URL-encoded paths for everything worth precaching in `dir`.
 * @param {string} dir a built `out/` directory
 * @returns {string[]}
 */
export function buildPrecacheList(dir) {
  return listFiles(dir).filter(shouldPrecache).map(toUrlPath);
}

/**
 * A cache name that changes whenever any precached byte changes — and only
 * then. Hashes each file's *contents* (not its mtime), so two builds of the
 * same source produce the same version and returning users keep their cache.
 * @param {string} dir
 * @param {string[]} urls output of `buildPrecacheList`
 * @returns {string} 12 hex characters
 */
export function computeCacheVersion(dir, urls) {
  const hash = createHash('sha256');

  for (const url of urls) {
    const relative = decodeURIComponent(url.slice(1));
    hash.update(url);
    hash.update('\0');
    hash.update(createHash('sha256').update(readFileSync(path.join(dir, relative))).digest('hex'));
    hash.update('\n');
  }

  return hash.digest('hex').slice(0, 12);
}

/**
 * Substitutes both placeholders into the template source.
 * @param {string} template
 * @param {string[]} urls
 * @param {string} version
 * @returns {string}
 */
export function renderServiceWorker(template, urls, version) {
  for (const placeholder of [MANIFEST_PLACEHOLDER, VERSION_PLACEHOLDER]) {
    const occurrences = template.split(placeholder).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `service-worker template: expected exactly 1 occurrence of ${placeholder}, found ${occurrences}`
      );
    }
  }

  // Replacer FUNCTIONS, not strings: `String.replace` interprets `$&`, `$$`,
  // "$`" and `$'` inside a string replacement, and Next emits `$` in its
  // segment payload filenames (`__next.health.$d$category.__PAGE__.txt`).
  // A string replacement would silently corrupt those URLs.
  return template
    .replace(MANIFEST_PLACEHOLDER, () => JSON.stringify(urls))
    .replace(VERSION_PLACEHOLDER, () => version);
}

/**
 * @param {{ outDir?: string, templatePath?: string }} [options]
 * @returns {{ urls: string[], version: string, outFile: string }}
 */
export function generateServiceWorker(options = {}) {
  const outDir = options.outDir ?? OUT_DIR;
  const templatePath = options.templatePath ?? TEMPLATE;

  let stat;
  try {
    stat = readdirSync(outDir);
  } catch {
    throw new Error(`generate-sw: ${outDir} does not exist — run \`next build\` first.`);
  }
  if (stat.length === 0) throw new Error(`generate-sw: ${outDir} is empty.`);

  const urls = buildPrecacheList(outDir);
  if (urls.length === 0) throw new Error(`generate-sw: nothing to precache in ${outDir}.`);

  const version = computeCacheVersion(outDir, urls);
  const source = renderServiceWorker(readFileSync(templatePath, 'utf8'), urls, version);

  const outFile = path.join(outDir, 'sw.js');
  writeFileSync(outFile, source, 'utf8');

  return { urls, version, outFile };
}

// Only run when invoked directly (`node scripts/generate-sw.mjs`), never on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { urls, version, outFile } = generateServiceWorker();
    const htmlCount = urls.filter((url) => url.endsWith('.html')).length;
    console.log(
      `generate-sw: wrote ${outFile} — ${urls.length} precached entries ` +
        `(${htmlCount} route HTML), cache unsmoke-${version}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
