#!/usr/bin/env node
/**
 * Seed places + barrios (both nested under the municipality doc):
 *   municipalities/{id}/places/{id}   — notable sites, discriminated by `kind`
 *                                       (cemetery/church/hermitage/plaza/town_hall)
 *   municipalities/{id}/barrios/{id}  — administrative subdivisions
 * Each carries an optional picture (uploaded to its `.../image/` prefix).
 *
 *   DATASET=demo_1 pnpm seed:dev:places
 *   DATASET=demo_1 pnpm seed:dev:places:wipe
 *
 * Requires villages seeded first (parent municipality doc must exist).
 */

import { buildBarrioData, buildPlaceData } from '@cultuvilla/shared/models';

import { WIPE, db, tag } from './lib/context.mjs';
import { loadDataset, resolveVillage } from './lib/dataset.mjs';
import { uploadImage, wipeStorageFolder } from './lib/images.mjs';
import { barrioDocId, placeDocId } from './lib/ids.mjs';
import { runAsMain } from './lib/run.mjs';

export async function seedPlaces(dataset) {
  for (const v of dataset.villages) {
    if (!v.places?.length && !v.barrios?.length) continue;
    const { vDocId, vKey } = await resolveVillage(dataset, v);
    for (const p of v.places ?? []) {
      const id = placeDocId(vKey, p.id);
      let imageURL = null;
      if (p.image) imageURL = await uploadImage(p.image, `municipalities/${vDocId}/places/${id}/image`);
      await db.collection('municipalities').doc(vDocId).collection('places').doc(id).set(
        tag(
          buildPlaceData({
            name: p.name,
            kind: p.kind,
            municipalityId: vDocId,
            description: p.description ?? null,
            images: imageURL ? [imageURL] : [],
          }),
        ),
        { merge: true },
      );
      console.log(`[seed] place ${id} (${p.kind})${imageURL ? ' + image' : ''} ✓`);
    }
    for (const b of v.barrios ?? []) {
      const id = barrioDocId(vKey, b.id);
      let imageURL = null;
      if (b.image) imageURL = await uploadImage(b.image, `municipalities/${vDocId}/barrios/${id}/image`);
      await db.collection('municipalities').doc(vDocId).collection('barrios').doc(id).set(
        tag(
          buildBarrioData({
            name: b.name,
            municipalityId: vDocId,
            images: imageURL ? [imageURL] : [],
          }),
        ),
        { merge: true },
      );
      console.log(`[seed] barrio ${id}${imageURL ? ' + image' : ''} ✓`);
    }
  }
}

export async function wipePlaces(dataset) {
  let docs = 0;
  let storage = 0;
  for (const v of dataset.villages) {
    if (!v.places?.length && !v.barrios?.length) continue;
    const { vDocId, vKey } = await resolveVillage(dataset, v);
    for (const p of v.places ?? []) {
      const id = placeDocId(vKey, p.id);
      await db.collection('municipalities').doc(vDocId).collection('places').doc(id).delete();
      storage += await wipeStorageFolder(`municipalities/${vDocId}/places/${id}/`);
      docs++;
    }
    for (const b of v.barrios ?? []) {
      const id = barrioDocId(vKey, b.id);
      await db.collection('municipalities').doc(vDocId).collection('barrios').doc(id).delete();
      storage += await wipeStorageFolder(`municipalities/${vDocId}/barrios/${id}/`);
      docs++;
    }
  }
  console.log(`[wipe] places/barrios: ${docs} doc(s) + ${storage} storage file(s) removed.`);
}

export async function run({ wipe = WIPE } = {}) {
  const dataset = await loadDataset();
  if (wipe) await wipePlaces(dataset);
  else await seedPlaces(dataset);
}

runAsMain(import.meta.url, run);
