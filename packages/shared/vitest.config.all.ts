import { defineConfig } from 'vitest/config';

// Runs every test category in @cultuvilla/shared under a single vitest
// invocation. Intended for orchestration by scripts/run-tests-with-emulators.mjs
// where the Firebase emulator suite is already running. Standalone use also
// works but the emulator must be up for integration/e2e tests to pass.
const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Same module-load env as the unit config so files that import
    // packages/shared/src/firebase.ts at module load don't blow up.
    env: {
      NEXT_PUBLIC_APP_ENV: 'dev',
      NEXT_PUBLIC_FIREBASE_API_KEY_DEV: 'AIzaSyTEST_DUMMY_PLACEHOLDER_KEY_0000000',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEV: 'test.example.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEV: 'test-project',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV: 'test.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEV: '0',
      NEXT_PUBLIC_FIREBASE_APP_ID_DEV: 'test-app-id',
    },
    include: [
      'test/config/**/*.test.ts',
      'test/models/**/*.test.ts',
      'test/services/**/*.test.ts',
      'test/firebase/**/*.test.ts',
      'test/eslint/**/*.test.ts',
      'test/design-system/**/*.test.ts',
      'test/utils/**/*.test.ts',
      'test/validation/**/*.test.ts',
      'test/integration/**/*.test.ts',
      'test/e2e/**/*.test.ts',
    ],
    setupFiles: [
      'test/setup/integration.setup.ts',
      'test/setup/e2e.setup.ts',
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
    // Report-only coverage (docs/plans/ongoing/testing-enhancement.md, D4). This
    // full-picture config (unit + integration + e2e under emulators) produces the
    // lcov CI would feed to diff-cover once a patch-coverage gate lands.
    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      all: true,
    },
  },
});
