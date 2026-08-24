#!/usr/bin/env node
/**
 * Load scripts/data/settlements-es.json into `_admin/settlements/seeds/{ine}`,
 * one document per municipality, so `startVillage` can seed a newly activated
 * village with its own pedanías, aldeas, parroquias and barrios.
 *
 * WHY FIRESTORE AND NOT THE FUNCTIONS BUNDLE
 *   The dataset is ~8.2MB across 8,167 municipalities. Bundling it would put
 *   that in every Cloud Function's deploy package. Activation needs exactly one
 *   municipality's entry, so a keyed document read is the right shape.
 *
 * WHY `_admin/`
 *   `_admin/**` is already `allow read, write: if false` for every client and
 *   the Admin SDK bypasses rules, so this reference data needs no rules of its
 *   own and cannot be tampered with. (`_admin` paths need an EVEN number of
 *   segments to be a document — this one is four.)
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills".
 *
 *   node scripts/backfill-settlement-seeds.mjs --env=dev            (dry run)
 *   node scripts/backfill-settlement-seeds.mjs --env=dev --apply
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const meta = {
  id: 'settlement-seeds',
  kind: 'backfill',
  description:
    'Load the OSM settlement dataset into _admin/settlements/seeds so village activation can seed pedanías, aldeas, parroquias and barrios',
  // Nothing crashes without it — activation simply seeds nothing — but the
  // feature is inert until the data is there, and it is purely additive.
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  dependsOn: [],
};

const DATA_PATH = path.join(__dirname, 'data', 'settlements-es.json');

export async function run({ db, apply, log }) {
  const entries = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  log(`_admin/settlements/seeds — ${entries.length} municipalities`);

  // Only write municipalities that actually have settlements. Seeding ~36 empty
  // documents would cost reads at activation for nothing.
  const withSettlements = entries.filter((e) => e.settlements.length > 0);

  let written = 0;
  let skipped = 0;
  const BATCH_SIZE = 400;

  for (let i = 0; i < withSettlements.length; i += BATCH_SIZE) {
    const chunk = withSettlements.slice(i, i + BATCH_SIZE);
    // Compare before writing so a re-run is genuinely a no-op rather than
    // 8,000 identical writes on every deploy.
    const refs = chunk.map((e) => db.doc(`_admin/settlements/seeds/${e.codigoINE}`));
    const snaps = await db.getAll(...refs);

    const batch = db.batch();
    let batchWrites = 0;
    chunk.forEach((entry, idx) => {
      const existing = snaps[idx].exists ? snaps[idx].data() : null;
      const next = {
        codigoINE: entry.codigoINE,
        name: entry.name,
        settlements: entry.settlements,
      };
      if (existing && JSON.stringify(existing) === JSON.stringify(next)) {
        skipped++;
        return;
      }
      if (apply) batch.set(refs[idx], next);
      batchWrites++;
    });

    if (apply && batchWrites > 0) await batch.commit();
    written += batchWrites;
  }

  log(
    `  seeds: ${withSettlements.length} municipalities with settlements — ` +
      `${apply ? 'wrote' : 'would write'} ${written}, already current ${skipped}`,
  );
  return { total: withSettlements.length, patched: written };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
