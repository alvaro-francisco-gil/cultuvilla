#!/usr/bin/env node
/**
 * seed-app-version-config.mjs
 *
 * Write the `config/appVersion` doc (the force-update gate) in one environment.
 * Clients read it on launch and block/nudge via `resolveVersionGate`.
 *
 * USAGE
 *   node scripts/seed-app-version-config.mjs [--env=dev|beta|prod] \
 *        [--latest=0.18.0] [--min=0.0.0] [--dry-run] [--confirm]
 *
 *   --env      target environment (default: dev).
 *   --latest   latest version. Defaults to the CURRENT apps/mobile/app.config.ts
 *              version — the single source of truth per AGENTS.md, rather than a
 *              constant here that silently goes stale.
 *   --min      minSupported. Omit to PRESERVE whatever is stored (see
 *              lib/app-version-config.mjs); only an explicit value moves the wall.
 *   --dry-run  print the diff and write nothing.
 *   --confirm  REQUIRED for beta/prod.
 *
 * No credentials of your own? Use Actions → "Set App Version"
 * (.github/workflows/set-app-version.yml), which authenticates via WIF.
 * Otherwise credentials resolve through initAdminForEnv; for beta/prod unset
 * GOOGLE_APPLICATION_CREDENTIALS so a dev key can't hijack the target project.
 */

import admin from 'firebase-admin';
import { initAdminForEnv, ENVS } from './lib/env-credentials.mjs';
import { currentAppVersion } from './lib/app-version.mjs';
import { resolveAppVersionConfig } from './lib/app-version-config.mjs';

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

if (!ENVS[envArg]) {
  console.error(`Unknown --env "${envArg}". Use one of: ${Object.keys(ENVS).join(', ')}.`);
  process.exit(1);
}

// Beta/prod are shared environments — require explicit acknowledgement, unless
// this is a read-only preview.
if ((envArg === 'beta' || envArg === 'prod') && args.confirm !== true && !dryRun) {
  console.error(
    `Refusing to write ${envArg} (${ENVS[envArg].project}) without --confirm. ` +
      `Beta/prod are off-limits without explicit intent (see AGENTS.md).`,
  );
  process.exit(1);
}

const { env, projectId } = initAdminForEnv(envArg);
const db = admin.firestore();
const ref = db.collection('config').doc('appVersion');

async function main() {
  const snap = await ref.get();
  const stored = snap.exists ? snap.data() : null;

  const { payload, minSource, latestSource } = resolveAppVersionConfig({
    latest: typeof args.latest === 'string' ? args.latest : undefined,
    minSupported: typeof args.min === 'string' ? args.min : undefined,
    stored,
    defaultLatest: currentAppVersion(),
  });

  console.log(`config/appVersion in ${env} (${projectId})`);
  console.log(`  stored: ${stored ? JSON.stringify(stored) : '(absent)'}`);
  console.log(`  latest       -> ${payload.ios.latest} (${latestSource})`);
  console.log(`  minSupported -> ${payload.ios.minSupported} (${minSource})`);

  if (dryRun) {
    console.log('\nDRY RUN — nothing written. Re-run without --dry-run to apply.');
    return;
  }

  await ref.set(payload, { merge: false });
  console.log(`\nWrote config/appVersion: ${JSON.stringify((await ref.get()).data())}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
