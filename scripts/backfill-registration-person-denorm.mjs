#!/usr/bin/env node
/**
 * Copy `photoURL` / `personUserId` / `isPersonPublic` from `persons` onto every
 * existing registration.
 *
 * The attendee roster is now readable by the whole pueblo, so it renders from
 * the registration doc alone instead of a `getPerson` per row — a fan-out one
 * organizer used to pay for and every viewer would now pay for. Registrations
 * written before this change carry none of the three fields.
 *
 * `isPersonPublic` is the load-bearing one: a dependent persona marked private
 * is counted but NOT named on the roster, and the schema defaults the field to
 * `true`. So until this runs, a private persona's name is shown to fellow
 * villagers — which is exactly what the privacy setting exists to prevent.
 * Hence `phase: 'pre-deploy'`: the data must lead the deploy, not follow it.
 *
 * Registered on the backfill harness: see AGENTS.md "Backfills" and
 * `pnpm backfills:list`.
 *
 *   node scripts/backfill-registration-person-denorm.mjs --env=dev            (dry run)
 *   node scripts/backfill-registration-person-denorm.mjs --env=dev --apply
 *   node scripts/backfill-registration-person-denorm.mjs --env=beta --confirm --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'registration-person-denorm',
  kind: 'backfill',
  description: 'Denormalize person photo/account/privacy onto registrations for the village-visible roster',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  // Projection: it writes registrations from persons, and event-group-signup
  // writes registrations too. Patching a source fires the currently-deployed
  // trigger, which rewrites projected rows with a full `set()` that predates
  // these fields — so this has to land after the source backfills, not
  // alongside them. Alphabetical order happens to put it last today; that is a
  // coincidence, and this is the declaration that survives a rename.
  dependsOn: ['event-group-signup', 'event-attendees-visibility'],
};

// A walk-in has no person doc at all (empty personId) — its name was typed by
// the organizer for the roster, so it stays visible. An unresolvable personId,
// by contrast, is a row we cannot vouch for: default it to private so a name we
// could not verify against `persons` is never published.
const WALK_IN = { photoURL: null, personUserId: null, isPersonPublic: true };
const UNRESOLVED = { photoURL: null, personUserId: null, isPersonPublic: false };

export async function run({ db, apply, log }) {
  log('registrations.{photoURL,personUserId,isPersonPublic}');

  // One read per distinct person, not per registration: a family signs the same
  // personas up to many events.
  const cache = new Map();
  async function personFor(personId) {
    if (cache.has(personId)) return cache.get(personId);
    const snap = await db.collection('persons').doc(personId).get();
    const data = snap.exists ? snap.data() : null;
    const denorm = data
      ? {
          photoURL: data.photoURL ?? null,
          personUserId: data.userId ?? null,
          // Absent isPublic predates person visibility; that backfill defaults
          // it to true, so match it rather than inventing a stricter answer.
          isPersonPublic: data.isPublic !== false,
        }
      : UNRESOLVED;
    cache.set(personId, denorm);
    return denorm;
  }

  async function patchFor(data) {
    const done =
      'photoURL' in data && 'personUserId' in data && 'isPersonPublic' in data;
    if (done) return null;
    return data.personId ? await personFor(data.personId) : WALK_IN;
  }

  const { total, patched } = await backfillCollection(
    db,
    'registrations',
    db.collectionGroup('registrations'),
    patchFor,
    { apply },
  );
  return { total, patched, personsRead: cache.size };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
