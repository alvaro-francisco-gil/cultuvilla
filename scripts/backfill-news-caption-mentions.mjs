#!/usr/bin/env node
/**
 * backfill-news-caption-mentions.mjs
 *
 * One-off: for every `news` doc in dev Firestore, ensure each image block in
 * `content` carries an explicit `captionMentions: []` (the field added when
 * captions gained @-mention support). The model reads it via `.default([])`, so
 * this is data hygiene, not a crash fix — it writes the field onto blocks that
 * predate it. See docs/plans/ready/news-mention-editor-highlight.md.
 *
 * USAGE
 *   node scripts/backfill-news-caption-mentions.mjs
 *
 * Idempotent: a doc whose image blocks already have `captionMentions` is left
 * untouched.
 */

import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set.');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

if (admin.app().options.projectId !== PROJECT_ID) {
  console.error(`Refusing to run against ${admin.app().options.projectId} — dev only.`);
  process.exit(1);
}

async function main() {
  const snap = await db.collection('news').get();
  console.log(`Loaded ${snap.size} news docs.`);

  let patched = 0;
  let untouched = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (!Array.isArray(data.content)) {
      untouched++;
      continue;
    }
    let anyChange = false;
    const newContent = data.content.map((block) => {
      if (block.type === 'image' && !Array.isArray(block.captionMentions)) {
        anyChange = true;
        return { ...block, captionMentions: [] };
      }
      return block;
    });
    if (!anyChange) {
      untouched++;
      continue;
    }
    batch.update(docSnap.ref, { content: newContent });
    patched++;
    inBatch++;
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await batch.commit();

  console.log(`\nDone.`);
  console.log(`  Untouched: ${untouched}`);
  console.log(`  Patched:   ${patched}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
