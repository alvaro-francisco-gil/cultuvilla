import { defineConfig } from 'vitest/config';

// Unlike packages/shared, this package has no Firebase entry point, so no
// placeholder env is needed — the catalog is plain JSON and the mobile-app
// scan is pure static file reads.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      // Report-only: opt in with `--coverage`; off by default so plain
      // `vitest run` stays fast and doesn't instrument.
      enabled: false,
    },
  },
});
