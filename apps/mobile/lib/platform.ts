import { Platform } from 'react-native';

/**
 * Return `value` only when running on the web target (Firebase Hosting build);
 * return `undefined` on iOS/Android. Use to scope a style override or
 * `screenOptions` entry to web without overriding native defaults.
 *
 * @example
 *   <Tabs screenOptions={{
 *     ...sharedOptions,
 *     ...webOnly({ tabBarStyle: { height: 64 } }),
 *   }} />
 */
export function webOnly<T>(value: T): T | undefined {
  return Platform.OS === 'web' ? value : undefined;
}

/**
 * Return `value` only when running on a native target (iOS or Android);
 * return `undefined` on web. Use to keep a behavior that only makes sense
 * with native APIs (e.g. `Alert.alert` with multiple buttons, native
 * gestures) out of the web bundle.
 */
export function nativeOnly<T>(value: T): T | undefined {
  return Platform.OS === 'web' ? undefined : value;
}

/**
 * `true` when running on the web target. Re-export of `Platform.OS === 'web'`
 * so consumers can `import { isWeb } from '../lib/platform'` and keep all
 * platform-branching imports consistent.
 */
export const isWeb = Platform.OS === 'web';

/**
 * Spread-friendly version of {@link webOnly} for object literals. Returns
 * the given object on web, an empty object on native — useful inside a
 * `screenOptions` spread when you want to keep the call site flat.
 *
 * @example
 *   <Tabs screenOptions={{ ...sharedOptions, ...webSpread({ tabBarStyle: { height: 64 } }) }} />
 */
export function webSpread<T extends object>(value: T): Partial<T> {
  return Platform.OS === 'web' ? value : ({} as Partial<T>);
}
