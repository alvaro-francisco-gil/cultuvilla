#!/usr/bin/env node
/**
 * backfill-news-mention-at.mjs
 *
 * One-off: for every `news` doc in dev Firestore, drop the leading '@' that the
 * old composer stored in each mention span's text, and rebase the affected
 * mention offsets/lengths (and the flattened `body`) to match the new
 * bare-label format. See docs/plans/ready/news-mention-editor-highlight.md.
 *
 * USAGE
 *   node scripts/backfill-news-mention-at.mjs
 *
 * Idempotent: a doc whose spans no longer start with '@' is left untouched.
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

/** Strip a leading '@' from each mention span in one text block. Returns null if nothing to do. */
function stripBlock(block) {
  if (block.type !== 'text' || !Array.isArray(block.mentions) || block.mentions.length === 0) return null;
  const sorted = [...block.mentions].sort((a, b) => a.offset - b.offset);
  let removed = 0;
  let prev = 0;
  let newText = '';
  const newMentions = [];
  let changed = false;
  for (const m of sorted) {
    const at = m.offset;
    if (block.text[at] === '@' && m.length > 1) {
      newText += block.text.slice(prev, at); // text before the '@', minus it
      newMentions.push({ ...m, offset: at - removed, length: m.length - 1 });
      removed += 1;
      prev = at + 1;
      changed = true;
    } else {
      newMentions.push({ ...m, offset: at - removed });
    }
  }
  if (!changed) return null;
  newText += block.text.slice(prev);
  return { ...block, text: newText, mentions: newMentions };
}

/** Mirror apps/mobile/app/news/new.tsx flattenBody. */
function flattenBody(content) {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text.trim())
    .filter(Boolean)
    .join('\n\n');
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
      const stripped = stripBlock(block);
      if (stripped) anyChange = true;
      return stripped ?? block;
    });
    if (!anyChange) {
      untouched++;
      continue;
    }
    batch.update(docSnap.ref, { content: newContent, body: flattenBody(newContent) });
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
