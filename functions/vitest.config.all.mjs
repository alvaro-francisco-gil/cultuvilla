import { defineConfig } from 'vitest/config';

// Runs every test category in functions/ under a single vitest invocation.
// Intended for orchestration by scripts/run-tests-with-emulators.mjs where
// the Firebase emulator suite is already running.
const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Both unit and integration trees:
    include: ['src/__tests__/**/*.test.ts'],
    // Integration handlers need the admin SDK setup; the unit config
    // excludes handlers but the all-config doesn't.
    setupFiles: ['src/__tests__/setup/admin.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
    // Report-only coverage (docs/plans/ongoing/testing-enhancement.md, D4). The
    // full-picture config (unit + handlers under emulators) — its lcov feeds
    // diff-cover once a patch-coverage gate lands.
    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/__tests__/**'],
      all: true,
    },
  },
});
