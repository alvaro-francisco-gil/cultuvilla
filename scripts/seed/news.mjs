#!/usr/bin/env node
/**
 * Seed news posts: one top-level `news/{id}` per village news entry, status
 * `approved` with `publishedAt` set so it surfaces in the feeds. Each image is
 * uploaded to `news/{postId}/images/` and recorded as `{storagePath,width,
 * height}` (news persists the storage PATH, not a URL — the app resolves it).
 *
 *   DATASET=demo_1 pnpm seed:dev:news
 *   DATASET=demo_1 pnpm seed:dev:news:wipe
 *
 * Requires users + villages seeded first (and orgs, if a post sets `orgId`).
 */

import { buildNewsPostData } from '@cultuvilla/shared/models';

import { WIPE, db, tag, uidForEmail } from './lib/context.mjs';
import { loadDataset, resolveVillage, uidForRef } from './lib/dataset.mjs';
import { imageDimensions, newsImagePath, uploadImageReturningPath, wipeStorageFolder } from './lib/images.mjs';
import { newsDocId, orgDocId } from './lib/ids.mjs';
import { runAsMain } from './lib/run.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Author by explicit email, else by dataset ref, else the village admin. */
async function resolveAuthor(dataset, post, adminUid) {
  if (post.authorEmail) return uidForEmail(post.authorEmail);
  if (post.authorRef) return uidForRef(dataset, post.authorRef);
  return adminUid;
}

export async function seedNews(dataset) {
  for (const v of dataset.villages) {
    if (!v.news?.length) continue;
    const { vDocId, vKey, adminUid } = await resolveVillage(dataset, v);
    for (const post of v.news) {
      const id = newsDocId(vKey, post.id);
      const authorUserId = await resolveAuthor(dataset, post, adminUid);

      const images = [];
      for (const ref of post.images ?? []) {
        const storagePath = await uploadImageReturningPath(ref, newsImagePath(id, ref));
        const { width, height } = await imageDimensions(ref);
        images.push({ storagePath, width, height });
      }

      // Rich block content: the first image becomes the dedicated card cover;
      // the body is the lead paragraph and any remaining images are interleaved
      // as inline blocks so seeded posts exercise the block renderer.
      const coverImage = images[0] ?? null;
      const content = [{ type: 'text', text: post.body, mentions: [] }];
      for (const img of images.slice(1)) {
        content.push({ type: 'image', storagePath: img.storagePath, width: img.width, height: img.height, caption: null });
      }

      const publishedAt = new Date(Date.now() - (post.publishedOffsetDays ?? 1) * DAY_MS);
      await db.collection('news').doc(id).set(
        tag(
          buildNewsPostData({
            municipalityId: vDocId,
            organizerUserIds: [authorUserId],
            organizerOrgIds: post.orgId ? [orgDocId(vKey, post.orgId)] : [],
            title: post.title,
            body: post.body,
            content,
            category: post.category,
            images,
            coverImage,
            status: post.status ?? 'approved',
            submittedAt: publishedAt,
            publishedAt,
            createdBy: authorUserId,
            updatedAt: publishedAt,
          }),
        ),
        { merge: true },
      );
      console.log(`[seed] news ${id} (${post.status ?? 'approved'})${images.length ? ` + ${images.length} image(s)` : ''} ✓`);
    }
  }
}

export async function wipeNews(dataset) {
  let docs = 0;
  let storage = 0;
  for (const v of dataset.villages) {
    for (const post of v.news ?? []) {
      const id = newsDocId(v.id, post.id);
      await db.collection('news').doc(id).delete();
      storage += await wipeStorageFolder(`news/${id}/`);
      docs++;
    }
  }
  console.log(`[wipe] news: ${docs} doc(s) + ${storage} storage file(s) removed.`);
}

export async function run({ wipe = WIPE } = {}) {
  const dataset = await loadDataset();
  if (wipe) await wipeNews(dataset);
  else await seedNews(dataset);
}

runAsMain(import.meta.url, run);
