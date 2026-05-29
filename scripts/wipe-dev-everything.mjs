#!/usr/bin/env node
/**
 * wipe-dev-everything.mjs
 *
 * Factory-reset the cultuvilla dev project (`villa-events`):
 *  - Firestore: every root collection (and its subcollections) recursively deleted.
 *  - Auth: every user account deleted.
 *  - Storage: every object in the default bucket deleted.
 *
 * THIS IS DESTRUCTIVE AND IRREVERSIBLE. Use it only to start over from a clean
 * slate, then restore via:
 *
 *   pnpm seed:municipalities                      # re-creates the 6k INE docs
 *   # optional, if you still have local escudo files:
 *   pnpm escudos:upload                           # rehydrates escudoUrl
 *   DATASET=real_user_data_1 pnpm seed:dev        # creates cultuvilla + Álvaro
 *   DATASET=real_villages_1 pnpm seed:villages    # activates Matabuena
 *
 * USAGE
 *   pnpm wipe:dev:everything --yes-i-am-sure
 *
 * The `--yes-i-am-sure` flag is required; without it the script just prints
 * the plan and exits.
 *
 * SAFETY
 *   - Hard-coded to project `villa-events`. Refuses anything else.
 *   - Requires GOOGLE_APPLICATION_CREDENTIALS (service-account key).
 */

import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const PROJECT_ID = 'villa-events';
const BUCKET = 'villa-events.firebasestorage.app';
const CONFIRMED = process.argv.includes('--yes-i-am-sure');

function resolveProjectId() {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  const firebaseJsonPath = path.join(repoRoot, 'firebase.json');
  if (existsSync(firebaseJsonPath)) {
    try {
      const fj = JSON.parse(readFileSync(firebaseJsonPath, 'utf8'));
      if (fj.projectId) return fj.projectId;
    } catch { /* ignore */ }
  }
  return PROJECT_ID;
}
const projectId = resolveProjectId();
if (projectId !== PROJECT_ID) {
  console.error(`[wipe] Refusing to run against project "${projectId}". Dev-only (${PROJECT_ID}).`);
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('[wipe] GOOGLE_APPLICATION_CREDENTIALS not set. See firebase-admin-dev skill.');
  process.exit(1);
}

admin.initializeApp({ projectId, storageBucket: BUCKET });
const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

async function wipeFirestore() {
  const colls = await db.listCollections();
  console.log(`[wipe] firestore: ${colls.length} root collection(s): ${colls.map((c) => c.id).join(', ') || '(none)'}`);
  for (const c of colls) {
    process.stdout.write(`[wipe]   ${c.id}… `);
    await db.recursiveDelete(c);
    console.log('done');
  }
}

async function wipeAuth() {
  let total = 0;
  let nextPageToken;
  do {
    const list = await auth.listUsers(1000, nextPageToken);
    if (list.users.length === 0) break;
    const uids = list.users.map((u) => u.uid);
    const result = await auth.deleteUsers(uids);
    total += result.successCount;
    if (result.failureCount > 0) {
      console.warn(`[wipe] auth: ${result.failureCount} delete failures on this page`);
    }
    nextPageToken = list.pageToken;
  } while (nextPageToken);
  console.log(`[wipe] auth: ${total} user(s) deleted`);
}

async function wipeStorage() {
  // bucket.deleteFiles({ force: true }) iterates pages internally.
  let total = 0;
  await bucket.deleteFiles({
    force: true,
    versions: true,
    onSuccess: () => { total++; },
  });
  console.log(`[wipe] storage: ${total} object(s) deleted from ${BUCKET}`);
}

function previewPlan() {
  console.log(`[wipe] PLAN — project=${projectId}`);
  console.log(`[wipe]   1. Recursively delete every Firestore root collection`);
  console.log(`[wipe]   2. Delete every Auth user`);
  console.log(`[wipe]   3. Delete every Storage object in ${BUCKET}`);
  console.log(`[wipe]`);
  console.log(`[wipe] Pass --yes-i-am-sure to actually run.`);
}

(async () => {
  if (!CONFIRMED) {
    previewPlan();
    return;
  }
  console.log(`[wipe] STARTING — project=${projectId}`);
  await wipeFirestore();
  await wipeAuth();
  await wipeStorage();
  console.log(`[wipe] DONE. Recovery:`);
  console.log(`[wipe]   pnpm seed:municipalities`);
  console.log(`[wipe]   DATASET=real_user_data_1 pnpm seed:dev`);
  console.log(`[wipe]   DATASET=real_villages_1 pnpm seed:villages   # optional`);
})().catch((err) => {
  console.error('[wipe] fatal:', err);
  process.exit(1);
});
