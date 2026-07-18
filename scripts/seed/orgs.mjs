#!/usr/bin/env node
/**
 * Seed organizations: one `organizations/{id}` per village org, status
 * `approved`, owned by the village admin. Uploads an optional `image` to
 * `organizations/{orgId}/image/` and wires it as `images[0]`.
 *
 *   DATASET=demo_1 pnpm seed:dev:orgs
 *   DATASET=demo_1 pnpm seed:dev:orgs:wipe
 *
 * Requires users + villages seeded first.
 */

import { buildOrganizationData } from '@cultuvilla/shared/models';

import { WIPE, db, tag } from './lib/context.mjs';
import { loadDataset, resolveVillage } from './lib/dataset.mjs';
import { uploadImage, wipeStorageFolder } from './lib/images.mjs';
import { orgDocId } from './lib/ids.mjs';
import { runAsMain } from './lib/run.mjs';

export async function seedOrgs(dataset) {
  for (const v of dataset.villages) {
    if (!v.organizations?.length) continue;
    const { vDocId, vKey, adminUid } = await resolveVillage(dataset, v);
    for (const org of v.organizations) {
      const oDocId = orgDocId(vKey, org.id);
      let imageURL = null;
      if (org.image) imageURL = await uploadImage(org.image, `organizations/${oDocId}/image`);
      await db.collection('organizations').doc(oDocId).set(
        tag(
          buildOrganizationData({
            name: org.name,
            description: org.description,
            images: imageURL ? [imageURL] : [],
            type: org.type,
            status: 'approved',
            municipalityId: vDocId,
            requestedBy: adminUid,
            reviewedBy: adminUid,
            reviewedAt: new Date(),
            membersPublic: org.membersPublic ?? true,
          }),
        ),
        { merge: true },
      );
      console.log(`[seed] org ${oDocId}${imageURL ? ' + image' : ''} ✓`);
    }
  }
}

export async function wipeOrgs(dataset) {
  let docs = 0;
  let storage = 0;
  for (const v of dataset.villages) {
    for (const org of v.organizations ?? []) {
      const oDocId = orgDocId(v.id, org.id);
      await db.collection('organizations').doc(oDocId).delete();
      storage += await wipeStorageFolder(`organizations/${oDocId}/`);
      docs++;
    }
  }
  console.log(`[wipe] orgs: ${docs} doc(s) + ${storage} storage file(s) removed.`);
}

export async function run({ wipe = WIPE } = {}) {
  const dataset = await loadDataset();
  if (wipe) await wipeOrgs(dataset);
  else await seedOrgs(dataset);
}

runAsMain(import.meta.url, run);
