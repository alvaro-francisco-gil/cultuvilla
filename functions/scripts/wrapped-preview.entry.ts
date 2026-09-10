import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { gatherWrappedInputs } from '../src/wrapped/gatherInputs';
import { composeWrapped } from '../src/wrapped/composeWrapped';
import { buildFiestaBlock, resolveFiestaWindow } from '@cultuvilla/shared/models';

/**
 * Render a village's Wrapped to local PNGs from real data, read-only.
 * Driven by `scripts/wrapped-preview.mjs`, which bundles this with the SAME
 * esbuild options as the deploy — so a preview that renders proves the deployed
 * bundle can too (fonts inlined, Satori's layout engine bundled, sharp external).
 */
const env = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`missing ${k}`);
  return v;
};

/**
 * A Madrid-local window over whole calendar days. Routed through
 * `resolveFiestaWindow` rather than re-derived here, so the preview and the
 * callable can never disagree about where a fiestas block starts and ends.
 */
function madridWindow(startDay: string, endDay: string): { start: Date; end: Date } {
  const [y, m, d] = startDay.split('-').map(Number);
  const days = Math.round((Date.parse(endDay) - Date.parse(startDay)) / 86_400_000) + 1;
  const block = buildFiestaBlock({ id: 'preview', name: 'preview', anchor: { month: m, day: d, days } });
  const w = resolveFiestaWindow(block, y);
  if (!w) throw new Error('could not resolve preview window');
  return { start: w.start, end: w.end };
}

async function main(): Promise<void> {
  const projectId = env('PREVIEW_PROJECT');
  const municipalityId = env('PREVIEW_MUNICIPALITY');
  const window = madridWindow(env('PREVIEW_START'), env('PREVIEW_END'));
  const out = env('PREVIEW_OUT');

  initializeApp({ projectId, credential: applicationDefault() });
  const db = getFirestore();

  const t0 = Date.now();
  const gathered = await gatherWrappedInputs(db, municipalityId, window);
  const t1 = Date.now();
  const { aggregate, images } = await composeWrapped(gathered, {
    blockName: env('PREVIEW_BLOCK'),
    year: window.start.getFullYear(),
  });
  const t2 = Date.now();

  mkdirSync(out, { recursive: true });
  for (const [card, img] of Object.entries(images)) writeFileSync(join(out, `${card}.${img.format === 'jpeg' ? 'jpg' : 'png'}`), img.bytes);
  const { countedEvents: _events, participantPersonIds: _ids, ...summary } = aggregate;
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));

  const sizes = Object.entries(images).map(([c, i]) => `${c} ${String(Math.round(i.bytes.length / 1024))}KB`).join(' · ');
  process.stdout.write(
    `\n${gathered.villageName} — ${String(gathered.people.length)} people, ${String(aggregate.stats.eventCount)} events\n` +
      `  gather ${String(t1 - t0)}ms · render ${String(t2 - t1)}ms\n  ${sizes}\n  → ${out}\n\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`\n[wrapped-preview] ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
