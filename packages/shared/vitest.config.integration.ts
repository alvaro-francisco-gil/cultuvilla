import { defineConfig } from 'vitest/config';

// Integration tests in @cultuvilla/shared.
// Hits the Firebase Emulator Suite (Firestore + Auth) via the client SDK.
// Run with: pnpm test:integration  (orchestrated by scripts/run-tests-with-emulators.mjs)
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    setupFiles: ['test/setup/integration.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
