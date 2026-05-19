/**
 * Per-environment Firebase Web SDK config, read from env vars.
 *
 * Each environment has its own set of NEXT_PUBLIC_FIREBASE_*_<ENV> keys
 * (suffix `_DEV`, `_BETA`, or `_PROD`). Local development reads from
 * `.env.local`; Vercel reads from the project's env-var configuration.
 *
 * The active environment is chosen by `NEXT_PUBLIC_APP_ENV` (one of
 * "dev" | "beta" | "prod"). `getFirebaseConfig()` returns the config
 * for the active env and fails fast if any required key is missing.
 *
 * Firebase Web SDK config values (`apiKey`, `projectId`, etc.) are not
 * secrets — they are public identifiers. See:
 * https://firebase.google.com/docs/projects/api-keys
 * Keeping them in env vars is a cleanliness preference, not a security
 * requirement; security is enforced by Firestore/Storage rules and
 * (optionally) App Check.
 */

export type AppEnv = 'dev' | 'beta' | 'prod';

export const APP_ENVS: readonly AppEnv[] = ['dev', 'beta', 'prod'] as const;

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  /** Only set when the project has Google Analytics enabled. */
  measurementId?: string;
}

/**
 * Throws on missing or unknown values. Fail-fast is intentional: a silent
 * fallback to the wrong project would corrupt the wrong dataset.
 */
export function resolveAppEnv(raw: string | undefined): AppEnv {
  if (raw === 'dev' || raw === 'beta' || raw === 'prod') return raw;
  throw new Error(
    `NEXT_PUBLIC_APP_ENV must be one of ${APP_ENVS.join(', ')} ` +
      `(got ${JSON.stringify(raw)}). Set it in .env.local for local ` +
      `development, or in your Vercel project's env vars for deployments.`,
  );
}

/**
 * Reads per-env config from `process.env`. Each branch uses literal env-var
 * names so Next.js can inline them at build time (DefinePlugin only handles
 * literal accesses, not computed keys like process.env[`FOO_${x}`]).
 */
function readConfig(env: AppEnv): FirebaseWebConfig {
  switch (env) {
    case 'dev':
      return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_DEV ?? '',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEV ?? '',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEV ?? '',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV ?? '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEV ?? '',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID_DEV ?? '',
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID_DEV,
      };
    case 'beta':
      return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_BETA ?? '',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_BETA ?? '',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID_BETA ?? '',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_BETA ?? '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_BETA ?? '',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID_BETA ?? '',
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID_BETA,
      };
    case 'prod':
      return {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY_PROD ?? '',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_PROD ?? '',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID_PROD ?? '',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_PROD ?? '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_PROD ?? '',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID_PROD ?? '',
        measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID_PROD,
      };
  }
}

const REQUIRED_KEYS: ReadonlyArray<keyof FirebaseWebConfig> = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
];

function assertComplete(env: AppEnv, cfg: FirebaseWebConfig): void {
  const missing = REQUIRED_KEYS.filter((k) => !cfg[k]);
  if (missing.length === 0) return;
  const suffix = env.toUpperCase();
  throw new Error(
    `Missing Firebase config for "${env}": ${missing.join(', ')}. ` +
      `Set NEXT_PUBLIC_FIREBASE_*_${suffix} env vars in .env.local or Vercel.`,
  );
}

export function getFirebaseConfig(rawEnv: string | undefined): FirebaseWebConfig {
  const env = resolveAppEnv(rawEnv);
  const cfg = readConfig(env);
  assertComplete(env, cfg);
  return cfg;
}
