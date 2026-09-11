#!/usr/bin/env node
/**
 * Copy each municipality's `slug` onto the entities that link to it —
 * `events`, `news`, `organizations`, `festivalPosters` — as `villageSlug`, so a
 * card can build its `/<pueblo>/…` URL without reading the municipality.
 *
 * Runs after `municipality-slug`: it reads the slugs that one writes. No trigger
 * listens to updates on these collections, so there is no projection to clobber.
 *
 *   node scripts/backfill-village-slug-denorm.mjs --env=dev            (dry run)
 *   node scripts/backfill-village-slug-denorm.mjs --env=dev --apply
 */

import { backfillCollection } from './lib/backfill.mjs';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';

export const meta = {
  id: 'village-slug-denorm',
  kind: 'backfill',
  description: 'Denormalize municipalities.slug onto events/news/organizations/festivalPosters/historyEntries as villageSlug',
  phase: 'pre-deploy',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  dependsOn: ['municipality-slug'],
};

const COLLECTIONS = ['events', 'news', 'organizations', 'festivalPosters', 'historyEntries'];

export async function run({ db, apply, log }) {
  const slugs = new Map();
  async function slugOf(municipalityId) {
    if (!slugs.has(municipalityId)) {
      const snap = await db.collection('municipalities').doc(municipalityId).get();
      slugs.set(municipalityId, snap.exists ? snap.get('slug') ?? null : null);
    }
    return slugs.get(municipalityId);
  }

  const counts = {};
  for (const name of COLLECTIONS) {
    log(`${name}.villageSlug`);
    counts[name] = await backfillCollection(
      db,
      name,
      db.collection(name),
      async (data, docSnap) => {
        if (typeof data.municipalityId !== 'string') return null;
        const slug = await slugOf(data.municipalityId);
        if (typeof slug !== 'string') {
          console.warn(`  ${name}/${docSnap.id}: municipality ${data.municipalityId} has no slug — skipped`);
          return null;
        }
        return data.villageSlug === slug ? null : { villageSlug: slug };
      },
      { apply },
    );
  }
  return counts;
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
