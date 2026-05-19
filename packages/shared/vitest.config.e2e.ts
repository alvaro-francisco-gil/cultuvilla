import { defineConfig } from 'vitest/config';

// E2E tests in @cultuvilla/shared: Firestore Security Rules.
// Uses @firebase/rules-unit-testing against the firestore emulator.
// Run with: pnpm test:rules  (orchestrated by scripts/run-tests-with-emulators.mjs)
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.test.ts'],
    setupFiles: ['test/setup/e2e.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
