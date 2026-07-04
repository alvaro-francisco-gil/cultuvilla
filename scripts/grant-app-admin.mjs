#!/usr/bin/env node
/**
 * grant-app-admin.mjs
 *
 * Grant (or revoke) the app-admin super-admin permission by writing/deleting the
 * Firestore doc at `/admins/{uid}`. Presence of that doc is what `isAppAdmin()`
 * in firestore.rules tests — it is the one manual, script-only step when
 * bootstrapping a new environment (see docs/ENVIRONMENTS.md). Everything else an
 * app-admin does happens in-app.
 *
 * The target account must have signed into the deployed app at least once so its
 * Auth user exists (we resolve the uid by email).
 *
 * USAGE
 *   node scripts/grant-app-admin.mjs --env <dev|beta|prod> --email <addr> [--yes] [--revoke]
 *
 *   pnpm grant:admin:dev  --email you@example.com
 *   pnpm grant:admin:beta --email cultuvilla.app@gmail.com --yes
 *   pnpm grant:admin:prod --email cultuvilla.app@gmail.com --yes
 *
 * CREDENTIALS
 *   Resolved per env from ~/.config/cultuvilla/<env>-sa.json (or an explicit
 *   GOOGLE_APPLICATION_CREDENTIALS override whose project_id must match).
 *   See scripts/lib/env-credentials.mjs and docs/ENVIRONMENTS.md.
 *
 * SAFETY
 *   - `--env` is required; beta/prod refuse to run without an explicit `--yes`.
 *   - The service-account key's project_id must match the target env.
 *   - Refuses if the account has no Auth user yet (must sign in once first).
 */

import admin from 'firebase-admin';

import { initAdminForEnv } from './lib/env-credentials.mjs';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

function die(msg) {
  console.error(`[grant-app-admin] ${msg}`);
  process.exit(1);
}

// Accept --env (dev|beta|prod); --project kept for backward compatibility.
const envArg = argValue('--env') ?? argValue('--project');
const email = argValue('--email');
const yes = process.argv.includes('--yes');
const revoke = process.argv.includes('--revoke');

if (!envArg) die('Missing --env <dev|beta|prod>.');
if (!email) die('Missing --email <address> of the account to grant.');

let ctx;
try {
  ctx = initAdminForEnv(envArg);
} catch (err) {
  die(err.message);
}
const { env, projectId, credPath, auth: authMethod } = ctx;

if (env !== 'dev' && !yes) {
  die(
    `Refusing to modify admins on non-dev env "${env}" (${projectId}) without --yes.\n` +
      `       Re-run with --yes once you are sure.`,
  );
}

const db = admin.firestore();
const auth = admin.auth();

async function main() {
  console.log(`[grant-app-admin] env=${env} project=${projectId} auth=${authMethod}${credPath ? ` cred=${credPath}` : ''}`);

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      die(
        `No Auth user for "${email}" on ${projectId}.\n` +
          `       The account must sign into the deployed app once before it can be granted admin.`,
      );
    }
    if (err.code === 'auth/insufficient-permission' || err.code === 'permission-denied') {
      die(
        `Credentials lack access to ${projectId} (auth=${authMethod}).\n` +
          `       Set up the persistent cultuvilla credential once, as a project Owner:\n` +
          `         gcloud auth application-default login\n` +
          `         gcloud auth application-default set-quota-project ${projectId}\n` +
          `         cp ~/.config/gcloud/application_default_credentials.json ~/.config/cultuvilla/adc.json && chmod 600 ~/.config/cultuvilla/adc.json\n` +
          `       See docs/ENVIRONMENTS.md → Admin-SDK credentials.`,
      );
    }
    throw err;
  }

  const ref = db.collection('admins').doc(user.uid);

  if (revoke) {
    await ref.delete();
    console.log(`[grant-app-admin] Revoked app-admin from ${email} (${user.uid}) on ${projectId}.`);
    return;
  }

  const existing = await ref.get();
  if (existing.exists) {
    console.log(`[grant-app-admin] ${email} (${user.uid}) is already an app-admin on ${projectId}. No change.`);
    return;
  }

  // Mirrors buildAdminData() — the doc body is an audit trail; presence is what matters.
  await ref.set({ createdAt: new Date() });
  console.log(`[grant-app-admin] Granted app-admin to ${email} (${user.uid}) on ${projectId}. ✓`);
}

main().catch((err) => {
  console.error('[grant-app-admin] Failed:', err);
  process.exit(1);
});
