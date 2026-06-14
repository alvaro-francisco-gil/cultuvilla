/**
 * Image helpers shared by the seeders: resolve a fixture image reference to a
 * file on disk, upload it to Cloud Storage, and read its dimensions.
 *
 * A fixture image reference is a string:
 *   - bare filename ("verbena.jpg")  → scripts/data/seed-fixtures/<dataset>/images/<filename>
 *   - path with a slash ("packages/shared/assets/icons/logo.png") → repo-relative, no copy
 */

import { existsSync } from 'fs';
import { readFile } from 'node:fs/promises';
import path from 'path';
import sharp from 'sharp';

import { BUCKET, DATASET_DIR, SEED_BATCH, bucket, repoRoot } from './context.mjs';

const IMAGE_FILE_PREFIX = 'seed-';
const CONTENT_TYPE_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

export function contentTypeFor(filename) {
  return CONTENT_TYPE_BY_EXT[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

export function publicUrl(objectPath) {
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(objectPath)}?alt=media`;
}

export function resolveImage(ref) {
  return ref.includes('/') ? path.join(repoRoot, ref) : path.join(DATASET_DIR, 'images', ref);
}

function localAbsOrThrow(ref) {
  const localAbs = resolveImage(ref);
  if (!existsSync(localAbs)) {
    throw new Error(
      `Image not found: ${path.relative(repoRoot, localAbs)} (referenced as "${ref}"). ` +
        `Run \`pnpm seed:images\` to download the dataset images first.`,
    );
  }
  return localAbs;
}

/** Read the pixel dimensions of a fixture image (needed for news `images[]`). */
export async function imageDimensions(ref) {
  const { width, height } = await sharp(localAbsOrThrow(ref)).metadata();
  return { width: width ?? 0, height: height ?? 0 };
}

/**
 * Upload an image to `<remoteFolder>/seed-<basename>` and return its public
 * download URL. Skips re-upload when an identical-size object already exists.
 */
export async function uploadImage(ref, remoteFolder) {
  const remotePath = `${remoteFolder}/${IMAGE_FILE_PREFIX}${path.basename(ref)}`;
  await uploadToPath(ref, remotePath);
  return publicUrl(remotePath);
}

/**
 * Upload an image to an explicit storage path and return that **path** (not a
 * URL). Used for news images, which persist `storagePath` rather than a URL.
 */
export async function uploadImageReturningPath(ref, remotePath) {
  await uploadToPath(ref, remotePath);
  return remotePath;
}

/** Build the news image storage path the app resolves at read time. */
export function newsImagePath(postId, ref) {
  return `news/${postId}/images/${IMAGE_FILE_PREFIX}${path.basename(ref)}`;
}

async function uploadToPath(ref, remotePath) {
  const buf = await readFile(localAbsOrThrow(ref));
  const file = bucket.file(remotePath);
  const [exists] = await file.exists();
  if (exists) {
    const [meta] = await file.getMetadata();
    if (Number(meta.size) === buf.length) return;
  }
  await file.save(buf, {
    contentType: contentTypeFor(ref),
    metadata: {
      cacheControl: 'public, max-age=86400',
      metadata: { seedBatch: SEED_BATCH },
    },
    resumable: false,
  });
}

/** Delete every storage object under a prefix (used by `--wipe`). */
export async function wipeStorageFolder(prefix) {
  try {
    const [files] = await bucket.getFiles({ prefix });
    if (!files.length) return 0;
    await Promise.all(files.map((f) => f.delete().catch(() => {})));
    return files.length;
  } catch (err) {
    console.warn(`[wipe] storage prefix ${prefix}: ${err.message}`);
    return 0;
  }
}
