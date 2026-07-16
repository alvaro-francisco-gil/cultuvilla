#!/usr/bin/env node
/**
 * backfill-news-bolds.mjs
 *
 * One-off: for every `news` doc in dev Firestore, ensure each text block in
 * `content` carries an explicit `bolds: []` and each image block carries
 * `captionBolds: []` (the fields added when the block editor gained bold
 * support). The model reads them via `.default([])`, so this is data hygiene,
 * not a crash fix — it writes the fields onto blocks that predate them.
 *
 * USAGE
 *   node scripts/backfill-news-bolds.mjs
 *
 * Credentials resolve via scripts/lib/env-credentials.mjs (dev only).
 * Idempotent: a doc whose blocks already carry the fields is left untouched.
 */

import { initAdminForEnv } from './lib/env-credentials.mjs';
import admin from 'firebase-admin';

const { projectId } = initAdminForEnv('dev');
const db = admin.firestore();
console.log(`Backfilling news bolds against ${projectId}\n`);

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
      if (block.type === 'text' && !Array.isArray(block.bolds)) {
        anyChange = true;
        return { ...block, bolds: [] };
      }
      if (block.type === 'image' && !Array.isArray(block.captionBolds)) {
        anyChange = true;
        return { ...block, captionBolds: [] };
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
