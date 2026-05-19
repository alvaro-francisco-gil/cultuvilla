import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Provide placeholder Firebase env so test files that import the shared
    // `firebase` entry (which initializes Auth) don't fail at module load.
    // No network calls are made; these values only need to satisfy
    // `firebase/auth`'s API-key shape check.
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: 'AIzaSyTEST_DUMMY_PLACEHOLDER_KEY_0000000',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.example.com',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test.appspot.com',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '0',
      NEXT_PUBLIC_FIREBASE_APP_ID: 'test-app-id',
    },
  },
});
