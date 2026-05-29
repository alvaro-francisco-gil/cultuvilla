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
import { initFirebase } from '@cultuvilla/shared/firebase';
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
 * Initialise Firebase with React Native AsyncStorage persistence.
 *
 * Idempotent — `initFirebase` returns early if already initialised, and the
 * module-level guard prevents the options object from being rebuilt on every
 * hot-reload.
 */
export function bootstrapFirebase(): void {
  const config = getFirebaseOptions();
  if (Platform.OS === 'web') {
    initFirebase(config);
  } else {
    initFirebase(config, {
      customizeAuth: (app) =>
        initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        }),
    });
  }
  initMobileAppCheck();
  installUnhandledFirestoreDenyHook();
}
