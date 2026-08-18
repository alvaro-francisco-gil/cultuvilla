#!/usr/bin/env node
/**
 * Copy every `events/{eventId}/registrationContacts/{regId}` doc to its
 * `registrationPrivate/{regId}` replacement, adding the `answers` map that
 * custom sign-up questions store alongside the phone.
 *
 * One private doc per registration now holds both — the old name stopped being
 * true the moment it carried a t-shirt size rather than a contact.
 *
 * PRE-DEPLOY: the new client reads `registrationPrivate`, so the data has to be
 * there before that code ships. The old deployed function keeps writing
 * `registrationContacts` until the deploy lands, which is what
 * `registration-contacts-drop` (post-deploy) mops up.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills".
 *
 *   node scripts/backfill-registration-private-merge.mjs --env=dev            (dry run)
 *   node scripts/backfill-registration-private-merge.mjs --env=dev --apply
 *   node scripts/backfill-registration-private-merge.mjs --env=beta --confirm --apply
 */

import { BatchWriter } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'registration-private-merge',
  kind: 'migration',
  description:
    'Copy events/*/registrationContacts to registrationPrivate, adding the signup-answers map',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: [],
};

/** Shared by the post-deploy cleanup so both write the identical shape. */
export function privateDocFrom(data) {
  return {
    name: typeof data.name === 'string' ? data.name : '',
    phone: typeof data.phone === 'string' && data.phone ? data.phone : null,
    answers: data.answers && typeof data.answers === 'object' ? data.answers : {},
  };
}

export async function copyContactsToPrivate(db, { apply, log }) {
  // Collection-group: registrationContacts lives under every event.
  const snap = await db.collectionGroup('registrationContacts').get();
  const writer = new BatchWriter(db, { apply });
  let copied = 0;

  for (const docSnap of snap.docs) {
    const target = docSnap.ref.parent.parent?.collection('registrationPrivate').doc(docSnap.id);
    if (!target) continue;
    // Re-copying is safe (the source is the authority until the deploy lands),
    // but skip when the target already matches so re-runs report honestly.
    const existing = await target.get();
    const want = privateDocFrom(docSnap.data());
    if (existing.exists && JSON.stringify(existing.data()) === JSON.stringify(want)) continue;
    copied++;
    await writer.set(target, want);
  }
  await writer.flush();

  log(
    `  registrationContacts: ${String(snap.size)} docs — ${apply ? 'copied' : 'would copy'} ${String(copied)}, already current ${String(snap.size - copied)}`,
  );
  return { total: snap.size, copied };
}

export async function run({ db, apply, log }) {
  log('registrationContacts -> registrationPrivate');
  const { total, copied } = await copyContactsToPrivate(db, { apply, log });
  return { total, patched: copied };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
