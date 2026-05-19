import Constants from 'expo-constants';

export type AppEnv = 'dev' | 'beta' | 'prod';

export function getAppEnv(): AppEnv {
  const raw = Constants.expoConfig?.extra?.APP_ENV;
  if (raw === undefined) return 'dev';
  if (raw === 'dev' || raw === 'beta' || raw === 'prod') return raw;
  throw new Error(`Unknown APP_ENV: ${String(raw)}`);
}
