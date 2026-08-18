import { Platform } from 'react-native';

// The global error handlers fire outside React, so they cannot reach the router
// through a hook. useRouteTracking mirrors the active route here on every
// navigation, so an unhandled error can still say which screen produced it.
let tracked: string | null = null;

export function setCurrentRoute(route: string): void {
  tracked = route;
}

/** Test-only: drop the mirrored route between cases. */
export function __resetCurrentRouteForTest(): void {
  tracked = null;
}

export function getCurrentRoute(): string | undefined {
  if (tracked) return tracked;
  // Before the first navigation settles, the browser still knows the entry URL.
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location?.pathname ?? undefined;
  }
  return undefined;
}
