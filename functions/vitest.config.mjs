import { defineConfig } from 'vitest/config';

const RETRY = Number.parseInt(process.env.VITEST_RETRY_COUNT ?? '0', 10);

// Default config: unit tests only (pure helpers, no emulator).
// Handler tests live in src/__tests__/handlers/ and are run via the
// integration config orchestrated by `pnpm test:functions` from the repo root.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    retry: Number.isFinite(RETRY) && RETRY > 0 ? RETRY : 0,
    exclude: ['src/__tests__/handlers/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Report-only coverage (docs/plans/ongoing/testing-enhancement.md, D4):
    // collected only with --coverage; no threshold gate yet.
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
