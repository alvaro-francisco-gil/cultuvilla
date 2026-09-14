import { randomUUID } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import type { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import {
  WRAPPED_CARDS,
  wrappedId,
  type FiestaBlock,
  type WrappedCard,
  type WrappedData,
} from '@cultuvilla/shared/models';
import { madridYear, resolveFiestaWindow } from '@cultuvilla/shared/models';
import { meetsAutoPublishFloor } from '@cultuvilla/shared/wrapped';
import { villageWrappedDoc } from '@cultuvilla/shared/firebase/refs/admin';
import { gatherWrappedInputs } from './gatherInputs';
import { composeWrapped, CARD_FORMATS } from './composeWrapped';

/** Days a draft waits for a village admin before it publishes itself. */
export const AUTO_PUBLISH_GRACE_DAYS = 3;

const EXT: Record<string, string> = { png: 'png', jpeg: 'jpg' };

/**
 * Where a card lives in the default bucket. Deterministic, so recomputing a
 * Wrapped overwrites its own images instead of littering the bucket.
 */
export function cardStoragePath(id: string, card: WrappedCard): string {
  return `villageWrapped/${id}/${card}.${EXT[CARD_FORMATS[card]]}`;
}

/**
 * Upload one card and return the URL anyone can open.
 *
 * A download token, not public ACLs or a signed URL: a Wrapped is meant to be
 * forwarded, and a shared image has to keep working after the sender closes
 * the app — a signed URL expires, which would break a WhatsApp message days
 * later. The token is unguessable and revocable by deleting the object, and it
 * is the same mechanism every other user-visible image in the product uses.
 */
async function uploadCard(id: string, card: WrappedCard, bytes: Buffer, format: string): Promise<string> {
  const path = cardStoragePath(id, card);
  const token = randomUUID();
  const file = getStorage().bucket().file(path);
  await file.save(bytes, {
    contentType: `image/${format}`,
    metadata: {
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  const bucket = file.bucket.name;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

export interface BuiltWrapped {
  id: string;
  data: WrappedData;
  /** False when the block has no exact window for that year, so nothing was built. */
  built: boolean;
}

/**
 * Compute, render, store and persist one block's Wrapped.
 *
 * Idempotent by construction: the doc id and every image path are derived from
 * `{municipalityId, year, blockId}`, so a rerun overwrites in place. What it
 * will NOT do is resurrect a decision — a doc already `published` or
 * `discarded` keeps that status and its `autoPublishAt` stays null.
 */
export async function buildAndStoreWrapped(
  db: Firestore,
  municipalityId: string,
  block: FiestaBlock,
  year: number,
  now: Date = new Date(),
): Promise<BuiltWrapped | null> {
  // `exactOnly`: an anchor is an approximation, and an approximate window
  // would silently clip or over-include events in a published summary.
  const window = resolveFiestaWindow(block, year, { exactOnly: true });
  if (!window) return null;

  const id = wrappedId(municipalityId, year, block.id);
  const ref = villageWrappedDoc(db, id);
  const existing = await ref.get();
  const previous = existing.data();

  const gathered = await gatherWrappedInputs(db, municipalityId, [window]);
  const { aggregate, images } = await composeWrapped(gathered, {
    blockNames: [block.name],
    year: madridYear(window.start),
  });

  const uploaded: [WrappedCard, string][] = [];
  for (const card of WRAPPED_CARDS) {
    const img = images[card];
    uploaded.push([card, await uploadCard(id, card, img.bytes, img.format)]);
  }
  const urls = Object.fromEntries(uploaded) as Record<WrappedCard, string>;

  // A thin block is computed and offered, never released on a timer: an
  // auto-published Wrapped showing one event makes the pueblo look dead on its
  // own noticeboard. Only an admin can decide that is worth showing.
  const floor = meetsAutoPublishFloor(aggregate.stats);
  const status = previous?.status ?? 'draft';
  const autoPublishAt =
    status === 'draft' && floor
      ? new Date(now.getTime() + AUTO_PUBLISH_GRACE_DAYS * 24 * 60 * 60 * 1000)
      : null;

  const data: WrappedData = {
    municipalityId,
    villageName: gathered.villageName,
    year,
    blockId: block.id,
    blockName: block.name,
    windowStart: window.start,
    windowEnd: window.end,
    status,
    autoPublishAt,
    computedAt: now,
    stats: aggregate.stats,
    fullestEvent: aggregate.fullestEvent,
    mostCommentedEvent: aggregate.mostCommentedEvent,
    topOrganizations: aggregate.topOrganizations,
    topOrganizers: aggregate.topOrganizers,
    images: urls,
  };
  await ref.set(data);

  logger.info('village wrapped built', {
    handler: 'buildAndStoreWrapped',
    municipalityId,
    wrappedId: id,
    year,
    blockId: block.id,
    status,
    eventCount: aggregate.stats.eventCount,
    autoPublishes: autoPublishAt !== null,
  });

  return { id, data, built: true };
}
