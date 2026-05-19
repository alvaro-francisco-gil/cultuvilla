import { defineConfig } from 'vitest/config';

// Default config: unit tests only (pure helpers, no emulator).
// Handler tests live in src/__tests__/handlers/ and are run via the
// integration config orchestrated by `pnpm test:functions` from the repo root.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    exclude: ['src/__tests__/handlers/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
