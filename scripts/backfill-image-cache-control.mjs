#!/usr/bin/env node
/**
 * Stamp `cacheControl: public, max-age=31536000, immutable` on every stored
 * image that lacks it.
 *
 * Without explicit metadata Firebase Storage serves `private, max-age=0`, so
 * the app re-downloaded every image on every render pass — the single largest
 * contributor to slow feed rendering. New uploads carry the header from
 * `imageService.IMAGE_UPLOAD_CACHE_CONTROL`; this catches everything already in
 * the bucket. Object names are unique per upload and never overwritten, so
 * `immutable` is accurate.
 *
 * Metadata-only: it does not touch object bytes, and re-running is a no-op.
 *
 *   node scripts/backfill-image-cache-control.mjs --env=dev            (dry run)
 *   node scripts/backfill-image-cache-control.mjs --env=dev --apply
 *   node scripts/backfill-image-cache-control.mjs --env=beta --confirm --apply
 */

import { isMain, runBackfill } from './lib/backfill-harness.mjs';
import { resolveDefaultBucket } from './lib/storage-bucket.mjs';

export const meta = {
  id: 'image-cache-control',
  kind: 'backfill',
  description: 'Stamp an immutable cacheControl on stored images so clients stop re-downloading them',
  // Storage metadata, not a Firestore field: no converter reads it, so no
  // deploy can be blocked by its absence. Purely a performance repair.
  phase: 'none',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  autoApply: ['dev', 'beta', 'prod'],
  dependsOn: [],
};

const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const PAGE_SIZE = 500;

export async function run({ admin, projectId, apply, log }) {
  const bucket = await resolveDefaultBucket(admin, projectId);
  log(`storage: ${bucket.name}`);

  let total = 0;
  let patched = 0;
  let pageToken;

  do {
    const [files, nextQuery] = await bucket.getFiles({
      maxResults: PAGE_SIZE,
      autoPaginate: false,
      pageToken,
    });

    for (const file of files) {
      const { contentType, cacheControl } = file.metadata;
      if (!contentType?.startsWith('image/')) continue;
      total += 1;
      if (cacheControl === CACHE_CONTROL) continue;
      patched += 1;
      if (apply) await file.setMetadata({ cacheControl: CACHE_CONTROL });
    }

    pageToken = nextQuery?.pageToken;
  } while (pageToken);

  log(`${patched}/${total} images ${apply ? 'stamped' : 'would be stamped'}`);
  return { total, patched };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
