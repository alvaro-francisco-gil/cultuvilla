// E2E setup: env vars for @firebase/rules-unit-testing.
// The rules-testing library reads FIRESTORE_EMULATOR_HOST to find the emulator.

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
process.env.TEST_PROJECT_ID ||= 'cultuvilla-rules-test';
process.env.GCLOUD_PROJECT ||= process.env.TEST_PROJECT_ID;
