import { defineConfig } from 'vitest/config';

const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Provide placeholder env so test files that import the shared `firebase`
    // entry (which initializes Auth via getFirebaseConfig at module load)
    // don't fail. No network calls are made; these values only satisfy the
    // fail-fast checks in packages/shared/src/config/environments.ts.
    env: {
      NEXT_PUBLIC_APP_ENV: 'dev',
      NEXT_PUBLIC_FIREBASE_API_KEY_DEV: 'AIzaSyTEST_DUMMY_PLACEHOLDER_KEY_0000000',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEV: 'test.example.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEV: 'test-project',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV: 'test.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEV: '0',
      NEXT_PUBLIC_FIREBASE_APP_ID_DEV: 'test-app-id',
    },
    // Default unit-test scope. Integration and e2e suites have their own
    // configs (vitest.config.integration.ts / vitest.config.e2e.ts).
    include: [
      'test/config/**/*.test.ts',
      'test/models/**/*.test.ts',
      'test/services/**/*.test.ts',
      'test/firebase/**/*.test.ts',
      'test/eslint/**/*.test.ts',
      'test/design-system/**/*.test.ts',
      'test/utils/**/*.test.ts',
    ],
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
  },
});
