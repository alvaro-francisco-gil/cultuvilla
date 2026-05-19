// Integration setup: configure Firebase emulator env vars before any module
// import. Loaded automatically by vitest.config.integration.ts.

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199';
process.env.FIREBASE_FUNCTIONS_EMULATOR_HOST ||= '127.0.0.1:5001';
process.env.TEST_PROJECT_ID ||= 'cultuvilla-test';
process.env.GCLOUD_PROJECT ||= process.env.TEST_PROJECT_ID;
