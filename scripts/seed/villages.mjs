#!/usr/bin/env node
/**
 * Seed villages: activates a community on `municipalities/{id}` (the doc IS the
 * municipality + community overlay), creates the admin `members/{uid}` subdoc,
 * uploads cover images (+ optional escudo) and wires their URLs in.
 *
 *   DATASET=demo_1 pnpm seed:dev:villages
 *   DATASET=demo_1 pnpm seed:dev:villages:wipe
 *
 * Requires users seeded first (resolves `adminUserRef` → uid).
 */

import {
  buildMunicipalityData,
  buildVillageCommunity,
  buildVillageMemberData,
} from '@cultuvilla/shared/models';

import { GeoPoint, WIPE, db, tag } from './lib/context.mjs';
import { loadDataset, uidForRef } from './lib/dataset.mjs';
import { uploadImage, wipeStorageFolder } from './lib/images.mjs';
import { villageDocId } from './lib/ids.mjs';
import { runAsMain } from './lib/run.mjs';

export async function seedVillage(v, adminUid) {
  const docId = villageDocId(v.id);

  const coverUrls = [];
  for (const file of v.coverImages ?? []) {
    coverUrls.push(await uploadImage(file, `villages/${docId}/images`));
  }
  let escudoUrl = null;
  if (v.escudo) escudoUrl = await uploadImage(v.escudo, `villages/${docId}/escudo`);

  const coords = new GeoPoint(v.coordinates.lat, v.coordinates.lng);
  const baseMunicipality = buildMunicipalityData({
    name: v.name,
    province: v.province,
    comunidadAutonoma: v.comunidadAutonoma,
    codigoINE: v.codigoINE,
    coordinates: coords,
    escudoUrl,
    escudoThumbUrl: escudoUrl,
  });
  const community = buildVillageCommunity({
    description: v.description,
    adminUserId: adminUid,
    coverImages: coverUrls,
  });
  await db
    .collection('municipalities')
    .doc(docId)
    .set(tag({ ...baseMunicipality, community, communityActive: true }), { merge: true });
  await db
    .collection('municipalities')
    .doc(docId)
    .collection('members')
    .doc(adminUid)
    .set(tag(buildVillageMemberData({ userId: adminUid, role: 'admin' })), { merge: true });
  console.log(
    `[seed] village ${docId} ✓ (${coverUrls.length} cover${escudoUrl ? ' + escudo' : ''})`,
  );
}

export async function seedVillages(dataset) {
  for (const v of dataset.villages) {
    // Request-flow villages (organizerEmail) are activated by `seed:villages`
    // / seed-village-requests.mjs against a real INE municipality — not here.
    if (v.organizerEmail) {
      console.log(`[seed] village ${v.name ?? v.id}: request-flow — activate via \`pnpm seed:villages\`, skipping.`);
      continue;
    }
    const adminUid = await uidForRef(dataset, v.adminUserRef);
    await seedVillage(v, adminUid);
  }
}

export async function wipeVillages(dataset) {
  let docs = 0;
  let storage = 0;
  for (const v of dataset.villages) {
    // Don't delete request-flow municipalities — they're real INE docs the
    // direct seeder never created. Use `pnpm seed:villages:wipe` for those.
    if (v.organizerEmail) continue;
    const vDocId = villageDocId(v.id);
    storage += await wipeStorageFolder(`villages/${vDocId}/images/`);
    storage += await wipeStorageFolder(`villages/${vDocId}/escudo/`);
    const membersSnap = await db
      .collection('municipalities')
      .doc(vDocId)
      .collection('members')
      .listDocuments();
    await Promise.all(membersSnap.map((d) => d.delete().catch(() => {})));
    await db.collection('municipalities').doc(vDocId).delete();
    docs += 1 + membersSnap.length;
  }
  console.log(`[wipe] villages: ${docs} doc(s) + ${storage} storage file(s) removed.`);
}

export async function run({ wipe = WIPE } = {}) {
  const dataset = await loadDataset();
  if (wipe) await wipeVillages(dataset);
  else await seedVillages(dataset);
}

runAsMain(import.meta.url, run);
