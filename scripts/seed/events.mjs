#!/usr/bin/env node
/**
 * Seed events: one top-level `events/{id}` per org event, with denormalized
 * village fields copied off the (already-seeded) municipality doc. Uploads
 * `image` to `villages/{vid}/events/{eid}/image/` and wires `imageURL`.
 *
 *   DATASET=demo_1 pnpm seed:dev:events
 *   DATASET=demo_1 pnpm seed:dev:events:wipe
 *
 * Requires users + villages + orgs seeded first.
 */

import { buildEventData, buildLocationData } from '@cultuvilla/shared/models';

import { GeoPoint, WIPE, db, tag } from './lib/context.mjs';
import { loadDataset, resolveVillage } from './lib/dataset.mjs';
import { uploadImage, wipeStorageFolder } from './lib/images.mjs';
import { eventDocId, orgDocId } from './lib/ids.mjs';
import { runAsMain } from './lib/run.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function seedEvents(dataset) {
  for (const v of dataset.villages) {
    if (!v.organizations?.some((o) => o.events?.length)) continue;
    const { vDocId, vKey, adminUid } = await resolveVillage(dataset, v);

    // Denormalized village fields come off the seeded municipality doc.
    const muni = (await db.collection('municipalities').doc(vDocId).get()).data();
    const villageCover = muni?.community?.coverImages?.[0] ?? null;
    const coords = muni?.coordinates ?? (v.coordinates ? new GeoPoint(v.coordinates.lat, v.coordinates.lng) : null);

    for (const org of v.organizations) {
      const oDocId = orgDocId(vKey, org.id);
      for (const ev of org.events ?? []) {
        const eDocId = eventDocId(vKey, org.id, ev.id);
        const startDate = new Date(Date.now() + ev.startOffsetDays * DAY_MS);
        const endDate =
          ev.durationHours == null
            ? null
            : new Date(startDate.getTime() + ev.durationHours * 60 * 60 * 1000);

        let imageURL = null;
        if (ev.image) {
          imageURL = await uploadImage(ev.image, `villages/${vDocId}/events/${eDocId}/image`);
        }

        await db.collection('events').doc(eDocId).set(
          tag(
            buildEventData({
              title: ev.title,
              description: ev.description,
              startDate,
              endDate,
              location: buildLocationData({ type: 'text', text: `Plaza Mayor, ${v.name}` }),
              price: ev.price ?? 0,
              maxAttendees: ev.maxAttendees ?? null,
              telephoneRequired: false,
              status: ev.status ?? 'published',
              organizationId: oDocId,
              organizationName: org.name,
              createdBy: adminUid,
              municipalityId: vDocId,
              municipalityName: v.name,
              municipalityCoverImage: villageCover,
              municipalityCoordinates: coords,
              imageURL,
            }),
          ),
          { merge: true },
        );
        console.log(
          `[seed] event ${eDocId} (${ev.status ?? 'published'})${imageURL ? ' + image' : ''} ✓`,
        );
      }
    }
  }
}

export async function wipeEvents(dataset) {
  let docs = 0;
  let storage = 0;
  for (const v of dataset.villages) {
    if (!v.organizations?.some((o) => o.events?.length)) continue;
    const { vDocId, vKey } = await resolveVillage(dataset, v);
    for (const org of v.organizations ?? []) {
      for (const ev of org.events ?? []) {
        await db.collection('events').doc(eventDocId(vKey, org.id, ev.id)).delete();
        docs++;
      }
    }
    storage += await wipeStorageFolder(`villages/${vDocId}/events/`);
  }
  console.log(`[wipe] events: ${docs} doc(s) + ${storage} storage file(s) removed.`);
}

export async function run({ wipe = WIPE } = {}) {
  const dataset = await loadDataset();
  if (wipe) await wipeEvents(dataset);
  else await seedEvents(dataset);
}

runAsMain(import.meta.url, run);
