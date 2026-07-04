import { defineConfig } from 'vitest/config';

const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

// Integration config: handler tests that exercise Cloud Function handlers
// against the Firebase emulator suite. Run via `pnpm test:functions` from
// the repo root, which boots the emulators first.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/handlers/**/*.test.ts'],
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
    setupFiles: ['src/__tests__/setup/admin.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    maxConcurrency: 1,
    // Report-only coverage (docs/plans/ongoing/testing-enhancement.md, D4).
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
