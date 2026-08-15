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
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

function patchVisibility(data) {
  return typeof data.isPublic === 'boolean' ? {} : { isPublic: true };
}

export async function run({ db, apply, log }) {
  log('person visibility flag');
  const persons = await backfillCollection(db, 'persons', db.collection('persons'), patchVisibility, { apply });
  const municipalityPeople = await backfillCollection(
    db,
    'municipalityPeople',
    db.collection('municipalityPeople'),
    patchVisibility,
    { apply },
  );
  return { persons, municipalityPeople };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
