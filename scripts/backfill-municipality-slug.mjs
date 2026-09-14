#!/usr/bin/env node
/**
 * Assign `municipalities.slug` — the permanent `/<pueblo>` URL segment — to every
 * municipality that lacks one.
 *
 * Slugs are assigned over the whole set at once (`assignMunicipalitySlugs`), so
 * a name shared by several municipalities gives every holder the province
 * suffix. A slug already stored is never moved: it is a permalink.
 *
 * Patching a municipality fires `syncVillageDenormalization`, which returns
 * early — it only reacts to name, escudo and coordinates.
 *
 *   node scripts/backfill-municipality-slug.mjs --env=dev            (dry run)
 *   node scripts/backfill-municipality-slug.mjs --env=dev --apply
 */

import { assignMunicipalitySlugs } from '@cultuvilla/shared/models';
import { BatchWriter } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'municipality-slug',
  kind: 'backfill',
  description: 'Assign municipalities.slug, the permanent /<pueblo> URL segment',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
};

export async function run({ db, apply, log }) {
  log('municipalities.slug');
  const snap = await db.collection('municipalities').get();
  const taken = [];
  const missing = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.slug === 'string' && data.slug.length > 0) {
      taken.push(data.slug);
    } else {
      missing.push({
        id: doc.id,
        name: data.name,
        province: data.province,
        codigoINE: data.codigoINE,
        communityActive: data.communityActive === true,
      });
    }
  }

  const slugs = assignMunicipalitySlugs(missing, taken);
  const writer = new BatchWriter(db, { apply });
  for (const [id, slug] of slugs) {
    await writer.update(db.collection('municipalities').doc(id), { slug });
  }
  await writer.flush();

  console.log(
    `  municipalities: ${snap.size} docs — ${apply ? 'patched' : 'would patch'} ${slugs.size}, already conformant ${taken.length}`,
  );
  return { total: snap.size, patched: slugs.size };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
