import type { ExpoConfig } from 'expo/config';
import type { FirebaseOptions } from 'firebase/app';

type Env = 'dev' | 'beta' | 'prod';

function resolveEnv(): Env {
  const raw = process.env.APP_ENV;
  if (raw === 'dev' || raw === 'beta' || raw === 'prod') return raw;
  return 'dev';
}

const env = resolveEnv();

const namePerEnv: Record<Env, string> = {
  dev: 'Dev',
  beta: 'Beta',
  prod: 'Cultuvilla',
};

const bundleIdPerEnv: Record<Env, string> = {
  dev: 'com.cultuvilla.app.dev',
  beta: 'com.cultuvilla.app.beta',
  prod: 'com.cultuvilla.app',
};

// Each env's deep-link host MUST be the Firebase Hosting site of that env's
// project (where the ogRenderer rewrites live). dev = villa-events project,
// beta = cultuvilla-beta, prod = cultuvilla-prod. The old villa-events-*.web.app
// sites never existed post-rename, so share links 404'd.
const deepLinkHostPerEnv: Record<Env, string> = {
  dev: process.env['DEEP_LINK_HOST_DEV'] ?? 'villa-events.web.app',
  beta: process.env['DEEP_LINK_HOST_BETA'] ?? 'cultuvilla-beta.web.app',
  prod: process.env['DEEP_LINK_HOST_PROD'] ?? 'cultuvilla-prod.web.app',
};

// Firebase config is injected per-environment from .env (or EAS secrets).
// DO NOT commit real keys — use a local .env file (gitignored) with these vars:
//   FIREBASE_API_KEY_DEV, FIREBASE_AUTH_DOMAIN_DEV, FIREBASE_PROJECT_ID_DEV,
//   FIREBASE_STORAGE_BUCKET_DEV, FIREBASE_MESSAGING_SENDER_ID_DEV, FIREBASE_APP_ID_DEV,
//   (same suffixes for _BETA and _PROD)
// Google Sign-In OAuth client IDs (one set per env). Get them from the
// Google Cloud Console for the matching Firebase project:
//   APIs & Services → Credentials → OAuth 2.0 Client IDs
// You need three per env: Web (used by Firebase to verify the idToken),
// iOS (must match the iOS bundle id), and Android (must match the package
// name + the SHA-1 of the signing key that built the app).
// The iOS URL scheme is the reversed iOS client id, prefixed with
// `com.googleusercontent.apps.` — copy the "iOS URL scheme" value shown
// by the GCP console.
interface GoogleSignInConfig {
  webClientId: string;
  iosClientId: string;
  iosUrlScheme: string;
}

const googleSignInPerEnv: Record<Env, GoogleSignInConfig> = {
  dev: {
    webClientId: process.env['GOOGLE_WEB_CLIENT_ID_DEV'] ?? '',
    iosClientId: process.env['GOOGLE_IOS_CLIENT_ID_DEV'] ?? '',
    iosUrlScheme: process.env['GOOGLE_IOS_URL_SCHEME_DEV'] ?? '',
  },
  beta: {
    webClientId: process.env['GOOGLE_WEB_CLIENT_ID_BETA'] ?? '',
    iosClientId: process.env['GOOGLE_IOS_CLIENT_ID_BETA'] ?? '',
    iosUrlScheme: process.env['GOOGLE_IOS_URL_SCHEME_BETA'] ?? '',
  },
  prod: {
    webClientId: process.env['GOOGLE_WEB_CLIENT_ID_PROD'] ?? '',
    iosClientId: process.env['GOOGLE_IOS_CLIENT_ID_PROD'] ?? '',
    iosUrlScheme: process.env['GOOGLE_IOS_URL_SCHEME_PROD'] ?? '',
  },
};

const firebaseConfigPerEnv: Record<Env, FirebaseOptions> = {
  dev: {
    apiKey: process.env['FIREBASE_API_KEY_DEV'] ?? '',
    authDomain: process.env['FIREBASE_AUTH_DOMAIN_DEV'] ?? '',
    projectId: process.env['FIREBASE_PROJECT_ID_DEV'] ?? '',
    storageBucket: process.env['FIREBASE_STORAGE_BUCKET_DEV'] ?? '',
    messagingSenderId: process.env['FIREBASE_MESSAGING_SENDER_ID_DEV'] ?? '',
    appId: process.env['FIREBASE_APP_ID_DEV'] ?? '',
  },
  beta: {
    apiKey: process.env['FIREBASE_API_KEY_BETA'] ?? '',
    authDomain: process.env['FIREBASE_AUTH_DOMAIN_BETA'] ?? '',
    projectId: process.env['FIREBASE_PROJECT_ID_BETA'] ?? '',
    storageBucket: process.env['FIREBASE_STORAGE_BUCKET_BETA'] ?? '',
    messagingSenderId: process.env['FIREBASE_MESSAGING_SENDER_ID_BETA'] ?? '',
    appId: process.env['FIREBASE_APP_ID_BETA'] ?? '',
  },
  prod: {
    apiKey: process.env['FIREBASE_API_KEY_PROD'] ?? '',
    authDomain: process.env['FIREBASE_AUTH_DOMAIN_PROD'] ?? '',
    projectId: process.env['FIREBASE_PROJECT_ID_PROD'] ?? '',
    storageBucket: process.env['FIREBASE_STORAGE_BUCKET_PROD'] ?? '',
    messagingSenderId: process.env['FIREBASE_MESSAGING_SENDER_ID_PROD'] ?? '',
    appId: process.env['FIREBASE_APP_ID_PROD'] ?? '',
  },
};

const config: ExpoConfig = {
  name: namePerEnv[env],
  slug: 'cultuvilla',
  version: '0.10.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'cultuvilla',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: bundleIdPerEnv[env],
    supportsTablet: true,
    associatedDomains: [`applinks:${deepLinkHostPerEnv[env]}`],
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Cultuvilla usa tu ubicación para fijar la del pueblo en el mapa.',
      // expo-image-picker reads the photo library to pick + crop avatars/escudos;
      // iOS requires this usage string.
      NSPhotoLibraryUsageDescription:
        'Cultuvilla necesita acceso a tus fotos para elegir y recortar tu imagen de perfil.',
    },
  },
  android: {
    package: bundleIdPerEnv[env],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: deepLinkHostPerEnv[env], pathPrefix: '/event/' },
          { scheme: 'https', host: deepLinkHostPerEnv[env], pathPrefix: '/news/' },
          { scheme: 'https', host: deepLinkHostPerEnv[env], pathPrefix: '/village/' },
          { scheme: 'https', host: deepLinkHostPerEnv[env], pathPrefix: '/o/' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
  },
  extra: {
    APP_ENV: env,
    firebaseConfig: firebaseConfigPerEnv[env],
    googleSignIn: googleSignInPerEnv[env],
    deepLinkHost: deepLinkHostPerEnv[env],
    // E2E only: when USE_FIREBASE_EMULATOR=1 (set ONLY by the web-e2e CI job,
    // never by any deploy workflow — deploy-*.yml positively assert it is unset),
    // firebaseInit wires the client SDK to the local emulators AND AuthContext
    // enables the fixture-login. One flag gates both halves, so a fixture session
    // can only be minted when the app points at 127.0.0.1 emulators. A deployed
    // build talks to real Firebase with no emulator reachable, so the bypass
    // fails closed even if this flag somehow leaked. The check:no-test-login-leak
    // grep gate blocks the flag/seam symbols from escaping their allowlisted files.
    useEmulator: process.env['USE_FIREBASE_EMULATOR'] === '1',
    // Dev-only auto sign-in: when DEV_AUTOLOGIN_EMAIL/PASSWORD are set in a
    // `dev` build, the app signs straight into that account on launch instead
    // of the email-link round-trip. Gated to env === 'dev' here AND behind
    // __DEV__ in AuthContext, so the creds never reach a beta/prod bundle.
    devAutoLogin:
      env === 'dev' &&
      process.env['DEV_AUTOLOGIN_EMAIL'] &&
      process.env['DEV_AUTOLOGIN_PASSWORD']
        ? {
            email: process.env['DEV_AUTOLOGIN_EMAIL'],
            password: process.env['DEV_AUTOLOGIN_PASSWORD'],
          }
        : null,
    eas: {
      projectId: process.env['EAS_PROJECT_ID'] ?? '',
    },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    ],
    ...(googleSignInPerEnv[env].iosUrlScheme
      ? [
          [
            '@react-native-google-signin/google-signin',
            { iosUrlScheme: googleSignInPerEnv[env].iosUrlScheme },
          ] as [string, { iosUrlScheme: string }],
        ]
      : []),
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Cultuvilla usa tu ubicación para fijar la del pueblo en el mapa.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
