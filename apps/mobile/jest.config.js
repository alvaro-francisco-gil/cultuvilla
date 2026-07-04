module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // jest-expo render suites are heavy (~12-15s each) and run in parallel; the
  // default 5000ms per-test limit is too tight under CI contention and flakes
  // (e.g. complete-profile timing out). 15s gives headroom without hiding hangs.
  testTimeout: 15000,
  // pnpm stores packages under .pnpm/; include it so nested ESM packages get transpiled
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@cultuvilla|nativewind|firebase|@firebase))',
  ],
  // babel-jest only matches [jt]sx? by default; add .mjs so firebase's postinstall.mjs is transpiled
  transform: { '\\.mjs$': 'babel-jest' },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // jest-expo's preset hard-codes `<rootDir>/packages/shared/src/$1`, which
    // assumes shared lives inside this app. In our monorepo it's at the
    // workspace root, so we override here.
    '^@cultuvilla/shared$': '<rootDir>/../../packages/shared/src',
    '^@cultuvilla/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    // @cultuvilla/i18n's entry is index.ts at the package root (no src/ dir).
    '^@cultuvilla/i18n$': '<rootDir>/../../packages/i18n/index',
    '^@cultuvilla/i18n/(.*)$': '<rootDir>/../../packages/i18n/$1',
  },
  // Report-only coverage (docs/plans/ongoing/testing-enhancement.md, D4): only
  // collected with `pnpm app:test:coverage` (jest --coverage); no gate yet.
  // v8 + lcov keeps the output format aligned with the vitest packages so a
  // future diff-cover step can merge one lcov set across the monorepo.
  coverageProvider: 'v8',
  coverageReporters: ['text-summary', 'lcov'],
  collectCoverageFrom: ['lib/**/*.ts', 'components/**/*.{ts,tsx}'],
};
