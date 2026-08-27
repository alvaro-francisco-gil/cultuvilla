#!/usr/bin/env node
/**
 * Generate the `_card` / `_thumb` WebP renditions for images uploaded before
 * the `generateImageVariants` trigger existed.
 *
 * The trigger only fires on new uploads, so without this every pre-existing
 * image would keep serving its full-size original to a card-sized box (dev held
 * posters up to 2.8 MB). Originals are never modified — the variants are new
 * sibling objects, so a bad run is re-runnable and nothing is lost.
 *
 * A variant's access always matches its original's: a token-carrying original
 * (a token bypasses storage.rules) gets the same token copied onto its
 * variants, while a seed-uploaded token-less original — served through the
 * public read rule via a bare `?alt=media` URL — gets token-less variants. The
 * client rewrite preserves the query string, so both shapes resolve.
 *
 *   node scripts/backfill-image-variants.mjs --env=dev            (dry run)
 *   node scripts/backfill-image-variants.mjs --env=dev --apply
 *   node scripts/backfill-image-variants.mjs --env=beta --confirm --apply
 */

import sharp from 'sharp';
import { isMain, runBackfill } from './lib/backfill-harness.mjs';
import { resolveDefaultBucket } from './lib/storage-bucket.mjs';
import {
  IMAGE_VARIANT_SUFFIX,
  isVariantExemptStoragePath,
  isVariantStoragePath,
  variantStoragePath,
} from '../packages/shared/dist/utils/imageVariants.js';

export const meta = {
  id: 'image-variants',
  kind: 'backfill',
  description: 'Generate downscaled card/thumb WebP renditions for images uploaded before the trigger existed',
  // Additive sibling objects. A missing variant degrades to the original via
  // RemoteImage's onError fallback, so no deploy is blocked by its absence.
  phase: 'none',
  envs: ['dev', 'beta', 'prod'],
  idempotent: true,
  owner: 'alvaro',
  // Deliberately NOT auto-applied: this one downloads and re-encodes every
  // stored image, so it is minutes of work and real egress. It is a one-off
  // repair, not something every deploy should redo — dispatch it per env via
  // Actions → "Run Backfill".
  autoApply: [],
  dependsOn: ['image-cache-control'],
};

// Mirrors VARIANT_MAX_EDGE in functions/src/images/generateImageVariants.ts.
const MAX_EDGE = { card: 1080, thumb: 240 };
const QUALITY = { card: 72, thumb: 68 };
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const PAGE_SIZE = 200;

function downloadTokenOf(metadata) {
  const raw = metadata?.metadata?.firebaseStorageDownloadTokens;
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return raw.split(',')[0];
}

export async function run({ admin, projectId, apply, log }) {
  const bucket = await resolveDefaultBucket(admin, projectId);
  log(`storage: ${bucket.name}`);

  let total = 0;
  let patched = 0;
  const skipped = [];
  let pageToken;

  do {
    const [files, nextQuery] = await bucket.getFiles({
      maxResults: PAGE_SIZE,
      autoPaginate: false,
      pageToken,
    });

    for (const file of files) {
      const name = file.name;
      const { contentType } = file.metadata;
      if (!contentType?.startsWith('image/')) continue;
      if (isVariantStoragePath(name) || isVariantExemptStoragePath(name)) continue;

      total += 1;
      const token = downloadTokenOf(file.metadata);

      const wanted = Object.keys(IMAGE_VARIANT_SUFFIX).map((variant) => ({
        variant,
        path: variantStoragePath(name, variant),
      }));
      const present = await Promise.all(
        wanted.map(async ({ path }) => (await bucket.file(path).exists())[0]),
      );
      if (present.every(Boolean)) continue;

      patched += 1;
      if (!apply) continue;

      // One object sharp cannot decode must not abort the sweep. Prod has HEIC
      // originals from before the client downscaled to WebP on upload, and the
      // runner's sharp has no libheif compiled in ("Support for this
      // compression format has not been built in") — that killed a prod run
      // 169 objects in, leaving 115 untouched and no marker. Skipping matches
      // what the live trigger already does with an undecodable object
      // (generateImageVariants logs and sets retry:false rather than hammering
      // it), and a missing variant degrades to the original anyway.
      try {
        const [source] = await file.download();
        for (const [i, { variant, path }] of wanted.entries()) {
          if (present[i]) continue;
          const body = await sharp(source, { failOn: 'none' })
            .rotate()
            .resize({
              width: MAX_EDGE[variant],
              height: MAX_EDGE[variant],
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: QUALITY[variant] })
            .toBuffer();
          await bucket.file(path).save(body, {
            contentType: 'image/webp',
            metadata: {
              cacheControl: CACHE_CONTROL,
              ...(token ? { metadata: { firebaseStorageDownloadTokens: token } } : {}),
            },
          });
        }
      } catch (err) {
        patched -= 1;
        const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
        skipped.push({ path: name, contentType, reason });
        log(`SKIPPED ${name} (${contentType}): ${reason}`);
      }
    }

    pageToken = nextQuery?.pageToken;
  } while (pageToken);

  log(`${patched}/${total} originals ${apply ? 'given variants' : 'would get variants'}`);

  // A partial sweep that reports itself as done is how a half-migrated bucket
  // gets forgotten. Name every skip, and put the count in the marker so the
  // record of the run says so too.
  if (skipped.length > 0) {
    log(`!! ${skipped.length} original(s) SKIPPED, still serving full-size:`);
    for (const s of skipped) log(`     ${s.path} (${s.contentType}): ${s.reason}`);
  }

  return { total, patched, skipped: skipped.length };
}

if (isMain(import.meta.url)) await runBackfill({ meta, run });
