import * as admin from 'firebase-admin';

// Initialize the Admin SDK as a side-effect import. Handler modules call
// getFirestore() at module top-level, so the default app must exist before they
// evaluate. ES-module semantics evaluate imports in source order before the
// importing module's body, so index.ts imports this FIRST (before any handler
// re-export) to guarantee init runs first under both the esbuild bundle and a
// plain tsc/CommonJS build.
admin.initializeApp();
