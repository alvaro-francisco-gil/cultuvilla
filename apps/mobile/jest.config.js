module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
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
    '^@cultuvilla/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    // @cultuvilla/i18n's entry is index.ts at the package root (no src/ dir).
    '^@cultuvilla/i18n$': '<rootDir>/../../packages/i18n/index',
    '^@cultuvilla/i18n/(.*)$': '<rootDir>/../../packages/i18n/$1',
  },
  collectCoverageFrom: ['lib/**/*.ts', 'components/**/*.{ts,tsx}'],
};
