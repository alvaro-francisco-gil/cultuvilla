#!/usr/bin/env node
/**
 * backfill-festivalPoster-images.mjs
 *
 * One-off: migrate dev festivalPoster docs from the scalar `imageURL` to the
 * ordered `images: string[]` array. For each doc that still has `imageURL`, set
 * `images: [imageURL]` (or `[]` if null) and delete `imageURL`.
 *
 * USAGE
 *   node scripts/backfill-festivalPoster-images.mjs             (dev, default)
 *   env -u GOOGLE_APPLICATION_CREDENTIALS \
 *     node scripts/backfill-festivalPoster-images.mjs --env=beta --confirm
 *
 * Credentials resolve via initAdminForEnv (see lib/env-credentials.mjs). Dev is
 * autonomous; beta/prod require --confirm (and the stored ADC — unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project).
 *
 * Idempotent: docs already migrated (no `imageURL` field) are skipped.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';
import { parseEnvConfirm } from './lib/env-confirm.mjs';
import { backfillCollection } from './lib/backfill.mjs';

const { projectId } = initAdminForEnv(parseEnvConfirm());
const db = admin.firestore();

function patchFor(data) {
  if (!('imageURL' in data)) return null; // already migrated
  const images = typeof data.imageURL === 'string' ? [data.imageURL] : [];
  return { images, imageURL: admin.firestore.FieldValue.delete() };
}

async function main() {
  console.log(`Backfilling festivalPoster images against ${projectId}`);
  await backfillCollection(db, 'festivalPosters', db.collection('festivalPosters'), patchFor);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
