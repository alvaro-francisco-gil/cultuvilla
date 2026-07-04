import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Marketing version of the running binary (falls back to the config value in dev/Expo Go). */
export function getRunningVersion(): string {
  return Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0.0.0';
}

/** Build number of the running binary. */
export function getRunningBuild(): string {
  return Constants.nativeBuildVersion ?? '0';
}

export function getGatePlatform(): 'ios' | 'android' | 'web' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}
