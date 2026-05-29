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
  },
  collectCoverageFrom: ['lib/**/*.ts', 'components/**/*.{ts,tsx}'],
};
