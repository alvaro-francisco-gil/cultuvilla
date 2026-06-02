import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  APP_ENVS,
  resolveAppEnv,
  getFirebaseConfig,
} from '../../src/config/environments';

/** Sets a complete fake Firebase config for one env via env-var stubs. */
function stubEnv(env: 'DEV' | 'BETA' | 'PROD', overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string> = {
    [`NEXT_PUBLIC_FIREBASE_API_KEY_${env}`]: `api-key-${env.toLowerCase()}`,
    [`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_${env}`]: `auth-${env.toLowerCase()}.example.com`,
    [`NEXT_PUBLIC_FIREBASE_PROJECT_ID_${env}`]: `project-${env.toLowerCase()}`,
    [`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_${env}`]: `bucket-${env.toLowerCase()}`,
    [`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_${env}`]: '1234567',
    [`NEXT_PUBLIC_FIREBASE_APP_ID_${env}`]: `app-id-${env.toLowerCase()}`,
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    if (v === undefined) vi.stubEnv(k, '');
    else vi.stubEnv(k, v);
  }
}

describe('APP_ENVS', () => {
  it('lists dev, beta, prod', () => {
    expect([...APP_ENVS]).toEqual(['dev', 'beta', 'prod']);
  });
});

describe('resolveAppEnv', () => {
  it('returns "dev" for "dev"', () => {
    expect(resolveAppEnv('dev')).toBe('dev');
  });

  it('returns "beta" for "beta"', () => {
    expect(resolveAppEnv('beta')).toBe('beta');
  });

  it('returns "prod" for "prod"', () => {
    expect(resolveAppEnv('prod')).toBe('prod');
  });

  it('throws for undefined', () => {
    expect(() => resolveAppEnv(undefined)).toThrow(/NEXT_PUBLIC_APP_ENV/);
  });

  it('throws for empty string', () => {
    expect(() => resolveAppEnv('')).toThrow(/NEXT_PUBLIC_APP_ENV/);
  });

  it('throws for unknown value with the bad value quoted', () => {
    expect(() => resolveAppEnv('staging')).toThrow(/"staging"/);
  });
});

describe('getFirebaseConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the dev config when env vars are present', () => {
    stubEnv('DEV');
    expect(getFirebaseConfig('dev')).toEqual({
      apiKey: 'api-key-dev',
      authDomain: 'auth-dev.example.com',
      projectId: 'project-dev',
      storageBucket: 'bucket-dev',
      messagingSenderId: '1234567',
      appId: 'app-id-dev',
      measurementId: undefined,
    });
  });

  it('returns the beta config when env vars are present', () => {
    stubEnv('BETA');
    expect(getFirebaseConfig('beta').projectId).toBe('project-beta');
  });

  it('returns the prod config when env vars are present', () => {
    stubEnv('PROD');
    expect(getFirebaseConfig('prod').projectId).toBe('project-prod');
  });

  it('includes measurementId when set', () => {
    stubEnv('DEV', { NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID_DEV: 'G-ABC123' });
    expect(getFirebaseConfig('dev').measurementId).toBe('G-ABC123');
  });

  it('throws listing missing keys when env vars are absent', () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_API_KEY_DEV', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN_DEV', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID_DEV', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET_DEV', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID_DEV', '');
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_APP_ID_DEV', '');
    expect(() => getFirebaseConfig('dev')).toThrow(/Missing Firebase config for "dev"/);
    expect(() => getFirebaseConfig('dev')).toThrow(/apiKey/);
    expect(() => getFirebaseConfig('dev')).toThrow(/NEXT_PUBLIC_FIREBASE_\*_DEV/);
  });

  it('propagates resolveAppEnv error for unknown env name', () => {
    expect(() => getFirebaseConfig('staging')).toThrow(/"staging"/);
  });
});
