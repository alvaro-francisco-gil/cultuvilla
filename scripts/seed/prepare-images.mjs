#!/usr/bin/env node
/**
 * prepare-images.mjs — one-time image fetcher (NOT run at seed time).
 *
 * Reads `scripts/data/seed-fixtures/<dataset>/images.manifest.mjs` (an array of
 * { file, url, width, height, square? }) and downloads each entry into the
 * dataset's `images/` folder, normalized/resized with sharp. Idempotent: skips
 * files that already exist. The downloaded files are meant to be committed so
 * seeding stays fully offline.
 *
 *   DATASET=demo_1 pnpm seed:images
 *   DATASET=demo_1 pnpm seed:images --force   # re-download even if present
 *
 * No Firebase credentials required — this only touches the local filesystem.
 */

import { existsSync, mkdirSync, readdirSync } from 'fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const FORCE = process.argv.includes('--force');
const DATASET = (process.env.DATASET ?? 'demo_1').trim();
const FIXTURES_ROOT = path.join(repoRoot, 'scripts', 'data', 'seed-fixtures');
const DATASET_DIR = path.join(FIXTURES_ROOT, DATASET);
const IMAGES_DIR = path.join(DATASET_DIR, 'images');

async function loadManifest() {
  const manifestPath = path.join(DATASET_DIR, 'images.manifest.mjs');
  if (!existsSync(manifestPath)) {
    const available = existsSync(FIXTURES_ROOT)
      ? readdirSync(FIXTURES_ROOT, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [];
    console.error(
      `[images] No images.manifest.mjs for dataset "${DATASET}" at ${path.relative(repoRoot, manifestPath)}\n` +
        `         Available datasets: ${available.join(', ') || '(none)'}`,
    );
    process.exit(1);
  }
  const mod = await import(pathToFileURL(manifestPath).href);
  const list = mod.default ?? mod.images ?? mod;
  if (!Array.isArray(list)) throw new Error('images.manifest.mjs must default-export an array');
  return list;
}

async function fetchBuffer(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function prepareOne(entry) {
  const { file, url, width, height, square } = entry;
  const dest = path.join(IMAGES_DIR, file);
  if (existsSync(dest) && !FORCE) {
    console.log(`[images] ${file} already present — skip`);
    return;
  }
  const w = width ?? 1200;
  const h = square ? w : height ?? Math.round(w * 0.66);
  const raw = await fetchBuffer(url);
  const ext = path.extname(file).toLowerCase();
  let pipeline = sharp(raw).resize(w, h, { fit: 'cover', position: 'centre' });
  if (ext === '.png') pipeline = pipeline.png();
  else if (ext === '.webp') pipeline = pipeline.webp({ quality: 82 });
  else pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
  await writeFile(dest, await pipeline.toBuffer());
  console.log(`[images] ${file} ← ${url} (${w}×${h}) ✓`);
}

(async () => {
  mkdirSync(IMAGES_DIR, { recursive: true });
  const manifest = await loadManifest();
  console.log(`[images] dataset=${DATASET} entries=${manifest.length} dir=${path.relative(repoRoot, IMAGES_DIR)}`);
  for (const entry of manifest) await prepareOne(entry);
  console.log('[images] done. Commit the files in', path.relative(repoRoot, IMAGES_DIR));
})().catch((err) => {
  console.error('[images] fatal:', err);
  process.exit(1);
});
