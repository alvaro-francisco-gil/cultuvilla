import { FlatCompat } from '@eslint/eslintrc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

// Service-layer ownership: components/pages/hooks must not call Firebase SDKs
// directly. Use functions from `@cultuvilla/shared/services/*`. The shared
// package re-exports `GeoPoint`, `Timestamp`, `User` from
// `@cultuvilla/shared/firebase` for the few cases that need types/values.
// AuthContext.tsx is the documented exception (it owns the auth boundary).
const restrictedFirebaseImports = {
  patterns: [
    {
      group: ['firebase/firestore', 'firebase/firestore/*'],
      message:
        'Use services from `@cultuvilla/shared/services/*`. For GeoPoint/Timestamp, import from `@cultuvilla/shared/firebase`.',
    },
    {
      group: ['firebase/storage', 'firebase/storage/*'],
      message: 'Use `@cultuvilla/shared/services/imageService` instead.',
    },
    {
      group: ['firebase/functions', 'firebase/functions/*'],
      message: 'Wrap callable functions in a service under `@cultuvilla/shared/services/*`.',
    },
    {
      group: ['firebase/auth', 'firebase/auth/*'],
      message:
        '`firebase/auth` is only allowed in `contexts/AuthContext.tsx`. For the `User` type, import from `@cultuvilla/shared/firebase`.',
    },
  ],
};

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Block direct Firebase SDK imports (service-layer ownership rule).
      'no-restricted-imports': ['error', restrictedFirebaseImports],
      // Treat `any` as an error (ordago-apps lesson: a few `@ts-nocheck` and
      // `as any` casts turned into hard-to-pay tech debt). Use `unknown` or
      // a precise type instead.
      '@typescript-eslint/no-explicit-any': 'error',
      // next/image is moot because next.config.ts sets `images.unoptimized=true`
      // — `<img>` and `next/image` are functionally identical here, and
      // Firebase Storage signed URLs would require `remotePatterns` upkeep.
      '@next/next/no-img-element': 'off',
    },
  },
  {
    // AuthContext is the auth boundary and is the only file allowed to call
    // into `firebase/auth` directly (sign-in/sign-out methods, listeners).
    files: ['contexts/AuthContext.tsx'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];

export default config;
