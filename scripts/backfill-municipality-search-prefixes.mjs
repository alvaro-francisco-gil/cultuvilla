#!/usr/bin/env node
/**
 * Populate `municipalities.searchPrefixes` (and `nameAliases`) — the array the
 * village-discovery search now queries with `array-contains`.
 *
 * Why: search used to be a `nameLower` range scan, which only matched the
 * *start of the full name*. 42% of Spanish municipality names are multi-word
 * and lead with a shared generic ("Villanueva de las Manzanas"), so a resident
 * typing the distinctive word got zero results. `searchPrefixes` indexes every
 * word, plus official-language aliases.
 *
 * `pre-deploy`: MunicipalityDataSchema now requires both fields, so the strict
 * converter throws on any doc that predates them — every screen that reads a
 * municipality would crash. Must run before the code that reads it ships.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-municipality-search-prefixes.mjs --env=dev            (dry run)
 *   node scripts/backfill-municipality-search-prefixes.mjs --env=dev --apply
 *   node scripts/backfill-municipality-search-prefixes.mjs --env=beta --confirm --apply
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';
import { searchPrefixes } from './lib/municipality-search.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const meta = {
  id: 'municipality-search-prefixes',
  kind: 'backfill',
  description:
    'Populate municipalities.searchPrefixes + nameAliases so discovery search matches any word of the name',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  // Purely additive and idempotent: derived entirely from `name` plus the
  // committed dataset, so the deploy can apply it unattended.
  autoApply: ['dev', 'beta', 'prod'],
  dependsOn: ['municipality-name-lower'],
};

// Aliases come from the committed dataset (Wikidata official-language labels),
// keyed by INE code. A municipality missing from it simply gets no aliases.
const dataset = JSON.parse(
  readFileSync(path.join(__dirname, 'data', 'municipalities-es.json'), 'utf8'),
);
const aliasesByIne = new Map(
  dataset.map((entry) => [entry.codigoINE, entry.nameAliases ?? []]),
);

function sameArray(a, b) {
  return Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
}

function patchFor(data) {
  if (typeof data.name !== 'string') return null;
  const wantAliases = aliasesByIne.get(data.codigoINE) ?? [];
  const wantPrefixes = searchPrefixes(data.name, wantAliases);
  if (sameArray(data.nameAliases, wantAliases) && sameArray(data.searchPrefixes, wantPrefixes)) {
    return null;
  }
  return { nameAliases: wantAliases, searchPrefixes: wantPrefixes };
}

export async function run({ db, apply, log }) {
  log('municipalities.searchPrefixes + nameAliases');
  const { total, patched } = await backfillCollection(
    db,
    'municipalities',
    db.collection('municipalities'),
    patchFor,
    { apply },
  );
  return { total, patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
