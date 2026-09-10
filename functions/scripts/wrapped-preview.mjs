#!/usr/bin/env node
/**
 * Render a village's Wrapped cards to PNGs from real data, read-only.
 *
 *   node scripts/wrapped-preview.mjs --municipality=digSmD1NFyaOJCPQ99cC \
 *     --start=2026-08-14 --end=2026-08-28 --block="Fiestas de agosto" [--project=cultuvilla-prod] [--out=DIR]
 *
 * Dates are Madrid calendar days; the window spans the whole of both.
 */
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { sharedBuildOptions } from '../esbuild.shared.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=')];
  }),
);
for (const k of ['municipality', 'start', 'end', 'block']) {
  if (!args[k]) {
    process.stderr.write(`missing --${k}\n`);
    process.exit(1);
  }
}

// Externals (firebase-admin, sharp) resolve by walking up from the bundle, so it
// must live inside functions/ — under node_modules/.cache it is also never committed.
const bundle = new URL('../node_modules/.cache/wrapped-preview.cjs', import.meta.url).pathname;
await build({
  ...sharedBuildOptions,
  entryPoints: [new URL('./wrapped-preview.entry.ts', import.meta.url).pathname],
  outfile: bundle,
  logLevel: 'warning',
});

const adc = join(homedir(), '.config', 'cultuvilla', 'adc.json');
const out = args.out || join(process.cwd(), 'wrapped-preview');
const res = spawnSync(process.execPath, [bundle], {
  stdio: 'inherit',
  env: {
    ...process.env,
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || (existsSync(adc) ? adc : ''),
    PREVIEW_PROJECT: args.project || 'cultuvilla-prod',
    PREVIEW_MUNICIPALITY: args.municipality,
    PREVIEW_START: args.start,
    PREVIEW_END: args.end,
    PREVIEW_BLOCK: args.block,
    PREVIEW_OUT: out,
  },
});
process.exit(res.status ?? 1);
