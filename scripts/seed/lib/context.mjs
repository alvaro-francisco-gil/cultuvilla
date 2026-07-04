/**
 * Shared seed context: admin SDK init, dev-project guard, dataset resolution.
 *
 * Imported by every per-domain seeder under `scripts/seed/`. The admin app is
 * initialized exactly once (guarded on `admin.apps.length`) so the `all.mjs`
 * orchestrator can import many seeders in one process without re-initializing.
 *
 * SAFETY: hard-locked to the dev project (`villa-events`). Refuses anything
 * else. See .claude/skills/firebase-admin-dev/SKILL.md.
 */

import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '..', '..', '..');

export const PROJECT_ID = 'villa-events';
export const BUCKET = 'villa-events.firebasestorage.app';

export const WIPE = process.argv.includes('--wipe');
export const DATASET = (process.env.DATASET ?? 'demo_1').trim();
export const DATASET_SLUG = DATASET.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
export const SEED_BATCH = `dev-fixtures-${DATASET_SLUG}`;

export const FIXTURES_ROOT = path.join(repoRoot, 'scripts', 'data', 'seed-fixtures');
export const DATASET_DIR = path.join(FIXTURES_ROOT, DATASET);

function resolveProjectId() {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
  const firebaseJsonPath = path.join(repoRoot, 'firebase.json');
  if (existsSync(firebaseJsonPath)) {
    try {
      const fj = JSON.parse(readFileSync(firebaseJsonPath, 'utf8'));
      if (fj.projectId) return fj.projectId;
    } catch {
      /* fall through */
    }
  }
  const rcPath = path.join(repoRoot, '.firebaserc');
  if (existsSync(rcPath)) {
    try {
      const rc = JSON.parse(readFileSync(rcPath, 'utf8'));
      if (rc?.projects?.default) return rc.projects.default;
    } catch {
      /* ignore */
    }
  }
  return PROJECT_ID;
}

// E2E seeding targets the local emulator, never the real dev project.
// firebase-admin auto-routes all reads/writes to the emulators once
// FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST are set (the web-e2e CI
// job sets them). In that mode we use the dedicated `cultuvilla-test` project id
// — NEVER villa-events, so a misconfigured run can't reach real data — and skip
// the ADC requirement (the emulator needs no credentials). The dev-only guards
// below apply ONLY to the real-project path.
export const EMULATOR =
  !!process.env.FIRESTORE_EMULATOR_HOST || process.env.SEED_TARGET === 'emulator';

let projectId;
if (EMULATOR) {
  projectId = process.env.GCLOUD_PROJECT || process.env.TEST_PROJECT_ID || 'cultuvilla-test';
  if (projectId === PROJECT_ID) {
    console.error(`[seed] Refusing to emulator-seed under the real project id "${PROJECT_ID}". Use cultuvilla-test.`);
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
  }
} else {
  projectId = resolveProjectId();
  if (projectId !== PROJECT_ID) {
    console.error(`[seed] Refusing to run against project "${projectId}". Dev-only (${PROJECT_ID}).`);
    process.exit(1);
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      '[seed] GOOGLE_APPLICATION_CREDENTIALS not set. Required for Storage uploads.\n' +
        '       See .claude/skills/firebase-admin-dev/SKILL.md for how to set it.',
    );
    process.exit(1);
  }
  if (!admin.apps.length) {
    admin.initializeApp({ projectId, storageBucket: BUCKET });
  }
}

export { projectId };
export const db = admin.firestore();
export const auth = admin.auth();
export const bucket = admin.storage().bucket();
export const { GeoPoint, FieldValue } = admin.firestore;

/** Stamp every seeded doc so the matching `--wipe` can find/verify it. */
export function tag(data) {
  return { ...data, seedBatch: SEED_BATCH };
}

/** Resolve an Auth uid from an email, or throw a helpful error. */
export async function uidForEmail(email) {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      throw new Error(
        `User "${email}" not found in Auth. Run \`DATASET=${DATASET} pnpm seed:dev:users\` first.`,
      );
    }
    throw err;
  }
}
