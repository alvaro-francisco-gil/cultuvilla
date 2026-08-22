#!/usr/bin/env node
/**
 * set-review-access.mjs
 *
 * Write (or clear) `_admin/reviewAccess` — the allowlisted address and fixed
 * 6-digit sign-in code handed to a store reviewer.
 *
 * Sign-in is an emailed OTP, so the only other way to let a Play/App Store
 * reviewer past the login is to give them the password of a real mailbox. This
 * gives exactly one address a code that never rotates instead. The pair lives
 * in Firestore rather than in git (the code must not be committed) and rather
 * than in Secret Manager (a missing secret fails the deploy in every env);
 * `_admin/**` is denied to all clients in firestore.rules.
 *
 * USAGE
 *   node scripts/set-review-access.mjs --env=dev --email=x@y.z --code=424242 [--dry-run] [--confirm]
 *   node scripts/set-review-access.mjs --env=prod --clear --confirm
 *
 *   --env      target environment (default: dev).
 *   --email    the allowlisted address. Must already be a user in that env.
 *   --code     the fixed 6-digit code. Omit to generate one and print it.
 *   --clear    delete the doc — revokes review access in that env immediately.
 *   --dry-run  print what would change and write nothing.
 *   --confirm  REQUIRED for beta/prod.
 *
 * REVOKE IT once the review is done: --clear costs nothing and a code that
 * never rotates is only worth its risk while a reviewer needs it.
 */

import { randomInt } from 'crypto';
import admin from 'firebase-admin';
import { initAdminForEnv, ENVS } from './lib/env-credentials.mjs';

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    out[key] = value ?? true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const envArg = typeof args.env === 'string' ? args.env : 'dev';
const dryRun = args['dry-run'] === true;
const clear = args.clear === true;

if (!ENVS[envArg]) {
  console.error(`Unknown --env "${envArg}". Use one of: ${Object.keys(ENVS).join(', ')}.`);
  process.exit(1);
}

if ((envArg === 'beta' || envArg === 'prod') && args.confirm !== true && !dryRun) {
  console.error(
    `Refusing to write ${envArg} (${ENVS[envArg].project}) without --confirm. ` +
      `Beta/prod are off-limits without explicit intent (see AGENTS.md).`,
  );
  process.exit(1);
}

const email = typeof args.email === 'string' ? args.email.trim() : '';
const code = typeof args.code === 'string' ? args.code.trim() : '';

if (!clear) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('--email is required and must be an email address (or pass --clear).');
    process.exit(1);
  }
  if (code && !/^\d{6}$/.test(code)) {
    console.error('--code must be exactly 6 digits.');
    process.exit(1);
  }
}

const { env, projectId } = initAdminForEnv(envArg);
const db = admin.firestore();
const ref = db.doc('_admin/reviewAccess');

async function main() {
  const snap = await ref.get();
  const stored = snap.exists ? snap.data() : null;

  console.log(`_admin/reviewAccess in ${env} (${projectId})`);
  console.log(`  stored: ${stored ? `${stored.email} / ${stored.code}` : '(absent — no review account)'}`);

  if (clear) {
    if (dryRun) {
      console.log('\nDRY RUN — would delete the doc. Re-run without --dry-run to apply.');
      return;
    }
    await ref.delete();
    console.log('\nCleared. Store-review sign-in is disabled in this environment.');
    return;
  }

  const finalCode = code || randomInt(0, 1_000_000).toString().padStart(6, '0');
  console.log(`  ->      ${email} / ${finalCode}`);

  if (dryRun) {
    console.log('\nDRY RUN — nothing written. Re-run without --dry-run to apply.');
    return;
  }

  // The Auth user has to exist: verifyAuthOtpCode would otherwise CREATE one on
  // first sign-in, and a brand-new account is in no village — a reviewer landing
  // in an empty app rejects for "cannot access app" with working credentials.
  try {
    const user = await admin.auth().getUserByEmail(email);
    console.log(`  auth user: ${user.uid} (created ${user.metadata.creationTime})`);
  } catch {
    console.warn(`  WARNING: no auth user for ${email} in ${env} — one will be created on first sign-in.`);
  }

  await ref.set({ email, code: finalCode }, { merge: false });
  console.log(`\nWrote _admin/reviewAccess. Put this pair in the store console:`);
  console.log(`  email: ${email}`);
  console.log(`  code:  ${finalCode}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
