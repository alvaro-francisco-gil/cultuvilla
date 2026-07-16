#!/usr/bin/env node
/**
 * backfill-news-marks.mjs
 *
 * One-off migration: the article block model replaced the bold-only `bolds` /
 * `captionBolds` arrays with a general typed `marks` / `captionMarks` array
 * (`{ type: 'bold'|'italic'|'underline'|'strikethrough', offset, length }`).
 * For every `news` doc in dev Firestore this:
 *   - text blocks:  folds `bolds` into `marks` as `{ type: 'bold', … }`, drops `bolds`.
 *   - image blocks: folds `captionBolds` into `captionMarks`, drops `captionBolds`.
 *   - fills an empty `marks` / `captionMarks` where the block predates the field.
 *
 * The model reads `marks` via `.default([])`, so this is data hygiene + cleanup
 * of the now-unknown `bolds` keys, not a crash fix.
 *
 * USAGE
 *   node scripts/backfill-news-marks.mjs
 *
 * Credentials resolve via scripts/lib/env-credentials.mjs (dev only).
 * Idempotent: a doc whose blocks already carry `marks`/`captionMarks` and no
 * stale `bolds`/`captionBolds` is left untouched.
 */

import { initAdminForEnv } from './lib/env-credentials.mjs';
import admin from 'firebase-admin';

const { projectId } = initAdminForEnv('dev');
const db = admin.firestore();
console.log(`Migrating news bolds → marks against ${projectId}\n`);

/** Fold a legacy `bolds` array (or []) into a `marks` array; returns null if no change is needed. */
function migrateBlock(block) {
  if (block.type === 'text') {
    const hasStaleBolds = 'bolds' in block;
    const hasMarks = Array.isArray(block.marks);
    if (!hasStaleBolds && hasMarks) return null;
    const fromBolds = Array.isArray(block.bolds)
      ? block.bolds.map((b) => ({ type: 'bold', offset: b.offset, length: b.length }))
      : [];
    const { bolds: _drop, ...rest } = block;
    return { ...rest, marks: [...(hasMarks ? block.marks : []), ...fromBolds] };
  }
  if (block.type === 'image') {
    const hasStaleBolds = 'captionBolds' in block;
    const hasMarks = Array.isArray(block.captionMarks);
    if (!hasStaleBolds && hasMarks) return null;
    const fromBolds = Array.isArray(block.captionBolds)
      ? block.captionBolds.map((b) => ({ type: 'bold', offset: b.offset, length: b.length }))
      : [];
    const { captionBolds: _drop, ...rest } = block;
    return { ...rest, captionMarks: [...(hasMarks ? block.captionMarks : []), ...fromBolds] };
  }
  return null;
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
      const migrated = migrateBlock(block);
      if (migrated) anyChange = true;
      return migrated ?? block;
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
