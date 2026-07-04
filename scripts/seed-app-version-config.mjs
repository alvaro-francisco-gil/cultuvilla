#!/usr/bin/env node
/**
 * seed-app-version-config.mjs
 *
 * One-off: seed config/appVersion in the dev Firestore with the initial
 * minSupported and latest versions, per platform.
 *
 * USAGE
 *   node scripts/seed-app-version-config.mjs
 *
 * Idempotent: uses merge:true to avoid write errors if the doc already exists.
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

async function main() {
  const ref = db.collection('config').doc('appVersion');
  await ref.set(
    {
      // Pre-release: minSupported 0.0.0 never blocks; latest tracks the current
      // app.config.ts version. Bump these (and raise minSupported) only once the
      // app is actually published. See "Versioning & releases" in AGENTS.md.
      ios: { minSupported: '0.0.0', latest: '0.1.0' },
      android: { minSupported: '0.0.0', latest: '0.1.0' },
      storeUrl: {
        ios: 'https://apps.apple.com/app/id000000000',
        android: 'https://play.google.com/store/apps/details?id=com.cultuvilla.app',
      },
    },
    { merge: true },
  );
  console.log('Seeded config/appVersion');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
