// Loaded by vitest before each test file in functions/.
// Sets the emulator env vars and initializes firebase-admin pointed at the
// Firestore + Auth emulators. Required for handler tests; harmless for the
// pure-helper tests.

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
process.env.GCLOUD_PROJECT ||= process.env.TEST_PROJECT_ID || 'cultuvilla-test';
process.env.FIREBASE_CONFIG ||= JSON.stringify({ projectId: process.env.GCLOUD_PROJECT });

import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
