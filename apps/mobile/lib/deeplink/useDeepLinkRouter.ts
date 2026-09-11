import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { parseLink } from '@cultuvilla/shared/services/deepLinkService';

/**
 * A link's path IS the app route — `/matabuena/evento/fiestas_e1` is both the
 * URL and the expo-router path — so routing a deep link is just replaying the
 * path we parsed. `parseLink` still gates it: an unknown host or an unknown
 * shape must fall through to the browser rather than open an app screen.
 */
function route(url: string): void {
  const parsed = parseLink(url);
  if (!parsed) return;
  const inviteQuery = parsed.kind === 'invite' && parsed.resource === 'organization' ? '?intent=join' : '';
  router.replace(`${parsed.path}${inviteQuery}` as never);
}

export function useDeepLinkRouter(): void {
  useEffect(() => {
    // Native-only. On web, expo-router already resolves every deep link by file
    // route (content routes + the village/org `join.tsx` redirect routes), so
    // this native `Linking`-based hook is redundant there — and its extra
    // `router.replace` races the route-level redirect during the logged-in
    // auth/profile load, re-triggering the village screen's focus-load and
    // leaving it stuck on a spinner. Let expo-router own web routing.
    if (Platform.OS === 'web') return;
    let cancelled = false;
    void Linking.getInitialURL().then((url) => {
      if (!cancelled && url) route(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => route(url));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
