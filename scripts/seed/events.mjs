#!/usr/bin/env node
/**
 * Seed events: one top-level `events/{id}` per org event, with denormalized
 * village fields copied off the (already-seeded) municipality doc. Uploads
 * `image` to `municipalities/{vid}/events/{eid}/image/` and wires `imageURL`.
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
    const villageCover = muni?.escudoManualUrl ?? muni?.escudoUrl ?? null;
    const coords = muni?.coordinates ?? (v.coordinates ? new GeoPoint(v.coordinates.lat, v.coordinates.lng) : null);
    // Real event location needs {lat,lng}: prefer the dataset's village coords,
    // else derive from the municipality GeoPoint.
    const locationCoords =
      v.coordinates ?? (coords ? { lat: coords.latitude, lng: coords.longitude } : null);

    for (const org of v.organizations) {
      const oDocId = orgDocId(vKey, org.id);
      for (const ev of org.events ?? []) {
        const eDocId = eventDocId(vKey, org.id, ev.id);
        const startDate = new Date(Date.now() + ev.startOffsetDays * DAY_MS);
        // Optional multi-day end; omit `endOffsetDays` for a single-day event.
        const endDate =
          ev.endOffsetDays != null ? new Date(Date.now() + ev.endOffsetDays * DAY_MS) : null;

        let imageURL = null;
        if (ev.image) {
          imageURL = await uploadImage(ev.image, `municipalities/${vDocId}/events/${eDocId}/image`);
        }

        await db.collection('events').doc(eDocId).set(
          tag(
            buildEventData({
              title: ev.title,
              description: ev.description,
              startDate,
              endDate,
              location: buildLocationData({
                coordinates: locationCoords,
                displayName: `Plaza Mayor, ${v.name}`,
              }),
              maxAttendees: ev.maxAttendees ?? null,
              telephoneRequired: false,
              status: ev.status ?? 'published',
              // Flexible ownership: the org runs it, attributed to the village admin.
              organizerUserIds: [adminUid],
              organizerOrgIds: [oDocId],
              createdBy: adminUid,
              municipalityId: vDocId,
              villageName: v.name,
              villageCoverImage: villageCover,
              villageCoordinates: coords,
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
    storage += await wipeStorageFolder(`municipalities/${vDocId}/events/`);
  }
  console.log(`[wipe] events: ${docs} doc(s) + ${storage} storage file(s) removed.`);
}

export async function run({ wipe = WIPE } = {}) {
  const dataset = await loadDataset();
  if (wipe) await wipeEvents(dataset);
  else await seedEvents(dataset);
}

runAsMain(import.meta.url, run);
