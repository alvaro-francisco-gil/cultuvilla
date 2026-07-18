import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
// @firebase/auth exports `getReactNativePersistence` only via the "react-native"
// export condition in its package.json. On native, Metro resolves it at
// runtime; on web, the symbol is undefined and calling it throws. The branch
// in bootstrapFirebase() ensures we never reach the call on web.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- getReactNativePersistence is in the RN bundle but absent from auth-public.d.ts
import { initializeAuth, getReactNativePersistence } from '@firebase/auth';
import type { FirebaseOptions } from 'firebase/app';
import Constants from 'expo-constants';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  inMemoryPersistence,
  indexedDBLocalPersistence,
} from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';
import { connectStorageEmulator } from 'firebase/storage';
import {
  initFirebase,
  getAuth,
  getDb,
  getFirebaseFunctions,
  getFirebaseStorage,
} from '@cultuvilla/shared/firebase';
import { FirebaseError } from '@firebase/util';
import { initMobileAppCheck } from './appCheck';

declare const __DEV__: boolean;

let unhandledHookInstalled = false;
function installUnhandledFirestoreDenyHook(): void {
  if (!__DEV__ || unhandledHookInstalled) return;
  unhandledHookInstalled = true;
  const target: { addEventListener?: typeof globalThis.addEventListener } =
    globalThis as never;
  if (typeof target.addEventListener !== 'function') return;
  target.addEventListener('unhandledrejection', (event: { reason?: unknown }) => {
    const reason = (event as { reason?: unknown }).reason;
    if (reason instanceof FirebaseError && reason.code === 'permission-denied') {
      console.warn(
        `[firestore-deny:unhandled] code=${reason.code} stack=${reason.stack ?? '<no stack>'}`,
      );
    }
  });
}

/**
 * Read the per-environment FirebaseOptions that app.config.ts wrote into
 * `extra.firebaseConfig`. Falls back to an empty object so the call still
 * proceeds (Firebase will throw a runtime error, which is the right behaviour
 * during development when .env is not set up).
 */
function getFirebaseOptions(): FirebaseOptions {
  const cfg = Constants.expoConfig?.extra?.firebaseConfig as FirebaseOptions | undefined;
  if (!cfg) {
    throw new Error(
      '[cultuvilla] firebaseConfig missing from expoConfig.extra. ' +
        'Add a .env file with FIREBASE_* vars and restart the bundler.',
    );
  }
  return cfg;
}

/**
 * E2E only — point the client SDK at the local Firebase emulators.
 *
 * Gated by the build-time `USE_FIREBASE_EMULATOR` flag (surfaced as
 * `extra.useEmulator`), which is set ONLY in the web-e2e CI job and never in a
 * deploy workflow. This is one half of the fail-closed fixture-login design:
 * the SAME flag also enables the test-login seam in AuthContext, so a fixture
 * session can only be minted while the app talks to `127.0.0.1` emulators. A
 * deployed build (real Firebase, no local emulator) cannot complete the flow
 * even if the flag leaked — it fails closed. The `check:no-test-login-leak`
 * grep gate keeps these symbols confined to their allowlisted files.
 */
let emulatorsConnected = false;
function connectEmulatorsIfEnabled(): void {
  if (emulatorsConnected) return;
  if (Constants.expoConfig?.extra?.useEmulator !== true) return;
  emulatorsConnected = true;
  // Web (Playwright) reaches the emulators on loopback. A native dev-client on an
  // Android AVD can't — `127.0.0.1` there is the device itself, so it must use the
  // host alias `10.0.2.2`. EXPO_PUBLIC_EMULATOR_HOST (baked in at build time) lets
  // the native groundwork flow override it; it defaults to loopback so the web
  // build and the fail-closed guarantee are unchanged.
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? '127.0.0.1';
  connectAuthEmulator(getAuth(), `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(getDb(), host, 8080);
  connectFunctionsEmulator(getFirebaseFunctions(), host, 5001);
  connectStorageEmulator(getFirebaseStorage(), host, 9199);
}

/**
 * Initialise Firebase with explicit, platform-appropriate auth persistence.
 *
 * Idempotent — `initFirebase` returns early if already initialised, and the
 * module-level guard prevents the options object from being rebuilt on every
 * hot-reload.
 */
export function bootstrapFirebase(): void {
  const config = getFirebaseOptions();
  if (Platform.OS === 'web') {
    // Pin the persistence chain explicitly rather than relying on
    // firebase/auth's environment auto-detection (plain getAuth(app)): the
    // default silently downgrades to session/in-memory persistence in
    // storage-restricted contexts (Safari private browsing, in-app browsers
    // like WhatsApp/Instagram webviews), which signs users out on every
    // visit and forces them back through the email-link round-trip.
    initFirebase(config, {
      customizeAuth: (app) =>
        initializeAuth(app, {
          persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
          popupRedirectResolver: browserPopupRedirectResolver,
        }),
    });
  } else {
    initFirebase(config, {
      customizeAuth: (app) =>
        initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        }),
    });
  }
  // Must run before any service issues a read/write; connect*Emulator throws
  // once the SDK has been used against production hosts.
  connectEmulatorsIfEnabled();
  initMobileAppCheck();
  installUnhandledFirestoreDenyHook();
}
