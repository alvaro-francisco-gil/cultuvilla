import { readdir, stat, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const IN = '/home/powervaro/githubs/cultuvilla/scripts/data/escudos';
const OUT_256 = '/tmp/escudos-256';
const OUT_64 = '/tmp/escudos-64';
await mkdir(OUT_256, { recursive: true });
await mkdir(OUT_64, { recursive: true });

const files = (await readdir(IN)).filter(f => f.endsWith('.svg'));
// Take a stratified sample: 200 files spread across the sorted size range
const stats = await Promise.all(files.map(async f => ({ f, size: (await stat(path.join(IN, f))).size })));
stats.sort((a, b) => a.size - b.size);
const N = 200;
const step = Math.max(1, Math.floor(stats.length / N));
const sample = [];
for (let i = 0; i < stats.length && sample.length < N; i += step) sample.push(stats[i]);

let raw = 0, w256 = 0, w64 = 0, ok = 0, fail = 0;
for (const { f, size } of sample) {
  raw += size;
  try {
    const src = await readFile(path.join(IN, f));
    const buf256 = await sharp(src, { density: 300 }).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 88 }).toBuffer();
    const buf64 = await sharp(src, { density: 300 }).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 85 }).toBuffer();
    await writeFile(path.join(OUT_256, f.replace('.svg', '.webp')), buf256);
    await writeFile(path.join(OUT_64, f.replace('.svg', '.webp')), buf64);
    w256 += buf256.length;
    w64 += buf64.length;
    ok++;
  } catch (e) {
    fail++;
  }
}

const fmt = n => n < 1024*1024 ? `${(n/1024).toFixed(1)} KB` : `${(n/1024/1024).toFixed(1)} MB`;
console.log(`Sample: ${ok} ok, ${fail} fail (${sample.length} attempted, stratified across size range)`);
console.log(`Raw SVG total:     ${fmt(raw)}  (avg ${fmt(raw/ok)})`);
console.log(`256px WebP total:  ${fmt(w256)}  (avg ${fmt(w256/ok)})  → ${(w256/raw*100).toFixed(1)}% of raw`);
console.log(`64px WebP total:   ${fmt(w64)}  (avg ${fmt(w64/ok)})  → ${(w64/raw*100).toFixed(1)}% of raw`);
console.log(`\nExtrapolated to 5,020 escudos:`);
console.log(`  256px WebP: ${fmt(w256/ok * 5020)}`);
console.log(`  64px WebP:  ${fmt(w64/ok * 5020)}`);
console.log(`  Combined:   ${fmt((w256+w64)/ok * 5020)}`);
