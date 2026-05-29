import { defineConfig } from 'vitest/config';

const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

// E2E tests in @cultuvilla/shared: Firestore Security Rules.
// Uses @firebase/rules-unit-testing against the firestore emulator.
// Run with: pnpm test:rules  (orchestrated by scripts/run-tests-with-emulators.mjs)
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.test.ts'],
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
    setupFiles: ['test/setup/e2e.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
