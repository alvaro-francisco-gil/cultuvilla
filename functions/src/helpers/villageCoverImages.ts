import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions/v2';
import { storageObjectPathFromDownloadUrl } from './storageDownloadUrl';

/**
 * Best-effort deletion of village cover image blobs from the default bucket.
 * Called when an organizer request is rejected so its uploaded covers don't
 * orphan. Never throws — a failed delete is logged and skipped so it can't
 * block resolving the request.
 */
export async function deleteVillageCoverImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  let bucket: ReturnType<ReturnType<typeof admin.storage>['bucket']>;
  try {
    bucket = admin.storage().bucket();
  } catch (err) {
    logger.warn('cover image cleanup skipped: no bucket', {
      handler: 'deleteVillageCoverImages',
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }
  await Promise.all(
    urls.map(async (url) => {
      const path = storageObjectPathFromDownloadUrl(url);
      if (!path) return;
      try {
        await bucket.file(path).delete();
      } catch (err) {
        logger.warn('cover image delete failed', {
          handler: 'deleteVillageCoverImages',
          path,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
}
