#!/usr/bin/env node
/**
 * optimize-escudos.mjs
 *
 * Rasterizes every escudo in scripts/data/escudos/ to two WebP sizes:
 *   - 256×256 (for detail screens, municipality cards)
 *   - 64×64   (for list rows, inline avatars)
 *
 * Output goes to scripts/data/escudos-webp/{ine}.webp and
 *                scripts/data/escudos-webp-thumb/{ine}.webp
 *
 * This script does NOT touch Firebase. Upload is a separate step.
 *
 * USAGE
 *   node scripts/optimize-escudos.mjs
 *   node scripts/optimize-escudos.mjs --limit 50   # quick sample
 */

import { mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IN_DIR = path.resolve(__dirname, 'data', 'escudos');
const OUT_256 = path.resolve(__dirname, 'data', 'escudos-webp');
const OUT_64 = path.resolve(__dirname, 'data', 'escudos-webp-thumb');

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1] ?? '0', 10) : 0;
const CONCURRENCY = 6;

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function pool(items, concurrency, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        results.push(await worker(items[idx], idx));
      } catch (err) {
        results.push({ status: 'fail', error: String(err?.message ?? err) });
      }
    }
  });
  await Promise.all(runners);
  return results;
}

async function convertOne(filename) {
  const ine = filename.replace(/\.[^.]+$/, '');
  const src = await readFile(path.join(IN_DIR, filename));
  // density:300 helps when source SVG declares small intrinsic size
  const base = () => sharp(src, { density: 300, limitInputPixels: false, unlimited: true });

  const buf256 = await base()
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 88, effort: 5 })
    .toBuffer();

  const buf64 = await base()
    .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 85, effort: 5 })
    .toBuffer();

  await writeFile(path.join(OUT_256, `${ine}.webp`), buf256);
  await writeFile(path.join(OUT_64, `${ine}.webp`), buf64);
  return { status: 'ok', ine, bytes256: buf256.length, bytes64: buf64.length };
}

async function main() {
  await mkdir(OUT_256, { recursive: true });
  await mkdir(OUT_64, { recursive: true });

  let files = (await readdir(IN_DIR)).filter(f => /\.(svg|png|jpg|jpeg|gif)$/i.test(f));
  if (LIMIT > 0) files = files.slice(0, LIMIT);

  console.log(`Converting ${files.length} escudos → 256px + 64px WebP (concurrency=${CONCURRENCY})...`);
  const t0 = Date.now();
  let done = 0;
  const results = await pool(files, CONCURRENCY, async f => {
    const r = await convertOne(f);
    done++;
    if (done % 100 === 0 || done === files.length) {
      process.stdout.write(`  ${done}/${files.length}\r`);
    }
    return r;
  });
  process.stdout.write('\n');

  const ok = results.filter(r => r.status === 'ok');
  const fail = results.filter(r => r.status === 'fail');
  const total256 = ok.reduce((s, r) => s + r.bytes256, 0);
  const total64 = ok.reduce((s, r) => s + r.bytes64, 0);

  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  Converted: ${ok.length}`);
  console.log(`  Failed:    ${fail.length}`);
  if (fail.length > 0) {
    console.log('  First 5 failures:');
    for (const f of fail.slice(0, 5)) console.log(`    ${f.error}`);
  }
  console.log(`\n  256px WebP total: ${fmtBytes(total256)}  (avg ${fmtBytes(total256 / ok.length)})`);
  console.log(`  64px  WebP total: ${fmtBytes(total64)}  (avg ${fmtBytes(total64 / ok.length)})`);
  console.log(`  Grand total:      ${fmtBytes(total256 + total64)}`);
  console.log(`\n  Output:`);
  console.log(`    ${OUT_256}`);
  console.log(`    ${OUT_64}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
