#!/usr/bin/env node
/**
 * Copy `birthday` from `persons` onto every existing
 * `events/{eventId}/registrationPrivate/{regId}` doc.
 *
 * The attendee-roster export now carries a "Fecha de nacimiento" column, read
 * from the organizer-gated private doc rather than from `persons`: a private
 * persona's card is denied to everyone but its creator, so an organizer could
 * never read it per row, and the registration doc itself is world-readable —
 * a birth date must never land there.
 *
 * `registerToEvent` / `claimEventSeat` denormalize it from this change on;
 * registrations written before carry nothing, so an organizer exporting an
 * event that already happened would get an empty column. Hence `pre-deploy`:
 * the data leads the deploy, and the gate blocks a promotion that would ship
 * the column without the values behind it.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-registration-private-birthday.mjs --env=dev            (dry run)
 *   node scripts/backfill-registration-private-birthday.mjs --env=dev --apply
 *   node scripts/backfill-registration-private-birthday.mjs --env=beta --confirm --apply
 */

import { BatchWriter } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'registration-private-birthday',
  kind: 'backfill',
  description: "Denormalize each attendee's birth date onto registrationPrivate for the roster export",
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  // registration-private-merge rewrites each private doc with a full set() —
  // no merge — so running before it would have the birth date silently wiped.
  // Alphabetical order puts this one first; this is the declaration that makes
  // the real order explicit rather than accidental.
  dependsOn: ['registration-private-merge'],
};

export async function run({ db, apply, log }) {
  log('persons.birthday -> registrationPrivate.birthday');

  // One read per distinct person, not per registration: a family signs the
  // same personas up to many events.
  const cache = new Map();
  async function birthdayFor(personId) {
    if (cache.has(personId)) return cache.get(personId);
    const snap = await db.collection('persons').doc(personId).get();
    const birthday = snap.exists ? (snap.data().birthday ?? null) : null;
    cache.set(personId, birthday);
    return birthday;
  }

  const regs = await db.collectionGroup('registrations').get();
  const writer = new BatchWriter(db, { apply });
  let patched = 0;

  for (const regSnap of regs.docs) {
    const eventRef = regSnap.ref.parent.parent;
    if (!eventRef) continue;
    const privateRef = eventRef.collection('registrationPrivate').doc(regSnap.id);
    const privateSnap = await privateRef.get();
    if (privateSnap.exists && 'birthday' in privateSnap.data()) continue;

    // A walk-in (empty personId) has no person doc, so there is nothing to
    // copy. Writing `birthday: null` onto its existing private doc is what
    // stops the next run from re-reading it; creating a doc for it would be
    // an empty doc holding nothing.
    const personId = regSnap.data().personId;
    const birthday = personId ? await birthdayFor(personId) : null;
    if (!privateSnap.exists && !birthday) continue;

    patched++;
    await writer.set(
      privateRef,
      // `name` only when creating: it is the shape the callables write, and
      // an existing doc already carries the one its own writer recorded.
      privateSnap.exists ? { birthday } : { name: regSnap.data().name ?? '', phone: null, answers: {}, birthday },
      { merge: true },
    );
  }
  await writer.flush();

  log(
    `  registrationPrivate.birthday: ${String(regs.size)} registrations — ${apply ? 'patched' : 'would patch'} ${String(patched)}, already current ${String(regs.size - patched)}`,
  );
  return { total: regs.size, patched, personsRead: cache.size };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
