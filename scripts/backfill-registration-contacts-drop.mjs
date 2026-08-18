#!/usr/bin/env node
/**
 * Finish the registrationContacts -> registrationPrivate rename: re-copy
 * anything the old deployed function wrote during the deploy window, then
 * delete the `registrationContacts` docs.
 *
 * POST-DEPLOY: until the new functions are live, `registerToEvent` still writes
 * `registrationContacts`. Deleting before the deploy would drop phones for
 * anyone who signed up in between; deleting after is safe because nothing
 * writes there any more.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills".
 *
 *   node scripts/backfill-registration-contacts-drop.mjs --env=dev            (dry run)
 *   node scripts/backfill-registration-contacts-drop.mjs --env=dev --apply
 *   node scripts/backfill-registration-contacts-drop.mjs --env=beta --confirm --apply
 */

import { BatchWriter } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';
import { copyContactsToPrivate } from './backfill-registration-private-merge.mjs';

export const meta = {
  id: 'registration-contacts-drop',
  kind: 'cleanup',
  description: 'Delete events/*/registrationContacts once registrationPrivate is live',
  // Blocking would deadlock: the docs can only go after the new code ships.
  phase: 'post-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

export async function run({ db, apply, log }) {
  // Catch stragglers written by the old function between the pre-deploy copy
  // and the deploy, so nothing is deleted before it has been carried over.
  log('re-copying stragglers before deletion');
  await copyContactsToPrivate(db, { apply, log });

  log('deleting registrationContacts');
  const snap = await db.collectionGroup('registrationContacts').get();
  const writer = new BatchWriter(db, { apply });
  for (const docSnap of snap.docs) {
    await writer.delete(docSnap.ref);
  }
  await writer.flush();

  log(
    `  registrationContacts: ${apply ? 'deleted' : 'would delete'} ${String(snap.size)} docs`,
  );
  return { total: snap.size, patched: snap.size };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
