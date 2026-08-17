// One-off asset generator: rasterises `public/icons/icon.svg` into the PNG
// sizes the web-app manifest and iOS need. Run manually after editing the SVG
// (`node scripts/generate-icons.mjs`); the PNGs it writes are committed, so
// this is deliberately NOT part of `pnpm build` — `sharp` stays a devDependency
// that never reaches the bundle.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = path.join(ROOT, 'public', 'icons');
const SOURCE_SVG = path.join(ICONS_DIR, 'icon.svg');

/** The rounded square's fill — reused as the flat backdrop behind padded renders. */
const BRAND_TEAL = '#0F766E';

/**
 * Renders the source mark at `size`, transparent outside the rounded square.
 * @param {Buffer} svg
 * @param {number} size
 */
function render(svg, size) {
  return sharp(svg, { density: 512 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
}

/**
 * Renders the mark inset inside a full-bleed teal square. Used for the
 * `maskable` icon (Android crops to an arbitrary shape, so the mark must sit
 * inside the inner 80% safe zone) and for iOS, which does its own rounding and
 * shows transparent corners as black.
 * @param {Buffer} svg
 * @param {number} size
 * @param {number} inset fraction of the canvas the mark occupies (1 = full bleed)
 */
async function renderPadded(svg, size, inset) {
  const inner = Math.round(size * inset);
  const offset = Math.round((size - inner) / 2);
  const mark = await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_TEAL,
    },
  })
    .composite([{ input: mark, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const svg = await readFile(SOURCE_SVG);
  await mkdir(ICONS_DIR, { recursive: true });

  /** @type {Array<[string, Promise<Buffer>]>} */
  const jobs = [
    ['icon-192.png', render(svg, 192)],
    ['icon-512.png', render(svg, 512)],
    // 20% safe-zone padding: the mark lives inside the inner 80%.
    ['icon-maskable-512.png', renderPadded(svg, 512, 0.8)],
    // iOS never masks aggressively, so the mark stays full-bleed on teal.
    ['apple-touch-icon.png', renderPadded(svg, 180, 1)],
  ];

  for (const [name, job] of jobs) {
    const buffer = await job;
    const file = path.join(ICONS_DIR, name);
    await writeFile(file, buffer);
    const { width, height } = await sharp(buffer).metadata();
    console.log(`${name}: ${width}x${height}, ${buffer.length} bytes`);
  }
}

await main();
