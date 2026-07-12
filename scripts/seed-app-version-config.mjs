#!/usr/bin/env node
/**
 * seed-app-version-config.mjs
 *
 * Seed / update the `config/appVersion` doc (the force-update gate config) in a
 * chosen Firebase environment.
 *
 * USAGE
 *   node scripts/seed-app-version-config.mjs [--env=dev|beta|prod] \
 *        [--min=0.0.0] [--latest=0.1.0] [--confirm]
 *
 *   --env      target environment (default: dev). Maps to the Firebase project.
 *   --min      minSupported version, both platforms (default: 0.0.0 = never block).
 *   --latest   latest version, both platforms (default: current pre-release
 *              app.config.ts version).
 *   --confirm  REQUIRED for --env=beta or --env=prod (guards against accidental
 *              writes to shared non-dev environments).
 *
 * Credentials: resolved by initAdminForEnv (GOOGLE_APPLICATION_CREDENTIALS
 * override → ~/.config/cultuvilla/<env>-sa.json → stored ADC). For beta/prod,
 * unset GOOGLE_APPLICATION_CREDENTIALS first so a dev key doesn't hijack the
 * target project. Dev is autonomous; beta/prod are gated — see the
 * `firebase-admin-dev` skill and the branch model in AGENTS.md. Not idempotent by
 * accident: it fully rewrites the doc (merge:false) so the whole gate config is
 * defined in one place.
 */

import admin from 'firebase-admin';
import { initAdminForEnv } from './lib/env-credentials.mjs';

// Environment → Firebase project id (see AGENTS.md branch model + eas.json).
const PROJECTS = {
  dev: 'villa-events',
  beta: 'cultuvilla-beta',
  prod: 'cultuvilla-prod',
};

const DEFAULT_MIN = '0.0.0'; // pre-release: never force-block
const DEFAULT_LATEST = '0.1.0'; // keep in step with apps/mobile/app.config.ts `version`

// Store URLs are the same across envs (one published app per store).
const STORE_URL = {
  ios: 'https://apps.apple.com/app/id000000000',
  android: 'https://play.google.com/store/apps/details?id=com.cultuvilla.app',
};

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

if (!PROJECTS[envArg]) {
  console.error(`Unknown --env "${envArg}". Use one of: ${Object.keys(PROJECTS).join(', ')}.`);
  process.exit(1);
}

// Beta/prod are shared environments — require an explicit acknowledgement.
if ((envArg === 'beta' || envArg === 'prod') && args.confirm !== true) {
  console.error(
    `Refusing to write ${envArg} (${PROJECTS[envArg]}) without --confirm. ` +
      `Beta/prod are off-limits without explicit intent (see AGENTS.md).`,
  );
  process.exit(1);
}

const min = typeof args.min === 'string' ? args.min : DEFAULT_MIN;
const latest = typeof args.latest === 'string' ? args.latest : DEFAULT_LATEST;

const { env, projectId } = initAdminForEnv(envArg);
const db = admin.firestore();

async function main() {
  const payload = {
    ios: { minSupported: min, latest },
    android: { minSupported: min, latest },
    storeUrl: STORE_URL,
  };
  await db.collection('config').doc('appVersion').set(payload, { merge: false });
  const snap = await db.collection('config').doc('appVersion').get();
  console.log(`Seeded config/appVersion in ${env} (${projectId}):`, JSON.stringify(snap.data()));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
