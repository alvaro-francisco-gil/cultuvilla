#!/usr/bin/env node
// Backfills parentCommentId: null and replyCount: 0 onto existing comment
// docs that predate the comment-threading feature. Idempotent — only
// touches docs missing either field.
import admin from 'firebase-admin';

const PROJECT_ID = 'villa-events';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

async function main() {
  if (process.env.GOOGLE_CLOUD_PROJECT !== PROJECT_ID && process.env.GCLOUD_PROJECT !== PROJECT_ID) {
    console.error(`Refusing to run: expected project ${PROJECT_ID}`);
    process.exit(1);
  }

  const snap = await db.collection('comments').get();
  let patched = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const update = {};
    if (!('parentCommentId' in data)) update.parentCommentId = null;
    if (!('replyCount' in data)) update.replyCount = 0;
    if (Object.keys(update).length > 0) {
      await docSnap.ref.update(update);
      patched++;
    }
  }
  console.log(`Patched ${patched}/${snap.size} comment docs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
