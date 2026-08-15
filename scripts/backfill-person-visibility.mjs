#!/usr/bin/env node
/**
 * Backfills `isPublic` on `persons/{id}` and its projection on
 * `municipalityPeople/{id}`.
 *
 * Both schemas now require the flag (strict Zod converter), so a doc written
 * before it existed crashes any screen that reads it. Existing people are all
 * public — that was the only behaviour available — so the backfill value is
 * `true` everywhere, matching `buildPersonData`'s default.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-person-visibility.mjs --env=dev            (dry run)
 *   node scripts/backfill-person-visibility.mjs --env=dev --apply
 *   node scripts/backfill-person-visibility.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'person-visibility',
  kind: 'backfill',
  description: 'Add persons.isPublic and municipalityPeople.isPublic so the strict converters can read pre-privacy docs',
  // Adds a field both converters REQUIRE, so the data must be fixed before the
  // code that reads it ships — the definition of pre-deploy.
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

/** Existing people predate the flag and were all public — the only behaviour there was. */
function patchFor(data) {
  return typeof data.isPublic === 'boolean' ? null : { isPublic: true };
}

export async function run({ db, apply, log }) {
  log('persons.isPublic + municipalityPeople.isPublic');
  const persons = await backfillCollection(db, 'persons', db.collection('persons'), patchFor, { apply });
  const rows = await backfillCollection(db, 'municipalityPeople', db.collection('municipalityPeople'), patchFor, {
    apply,
  });
  return {
    total: persons.total + rows.total,
    patched: persons.patched + rows.patched,
    persons,
    municipalityPeople: rows,
  };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
