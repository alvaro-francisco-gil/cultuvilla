import { defineConfig } from 'vitest/config';

// Integration config: handler tests that exercise Cloud Function handlers
// against the Firebase emulator suite. Run via `pnpm test:functions` from
// the repo root, which boots the emulators first.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/handlers/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup/admin.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
  },
});
