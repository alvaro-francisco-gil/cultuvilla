import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import {
  parseLink,
  type DeepLinkResource,
} from '@cultuvilla/shared/services/deepLinkService';

// Flat (top-level) resources. Nested resources (place, barrio) live under a
// village and are routed separately below.
const RESOURCE_TO_ROUTE: Partial<Record<DeepLinkResource, string>> = {
  event: 'event',
  news: 'news',
  village: 'village',
  organization: 'o',
  person: 'person',
};

function route(url: string): void {
  const parsed = parseLink(url);
  if (!parsed) return;
  if (parsed.resource === 'place' || parsed.resource === 'barrio') {
    if (!parsed.parentId) return;
    router.replace(
      `/village/${parsed.parentId}/${parsed.resource}/${parsed.id}` as never,
    );
    return;
  }
  const segment = RESOURCE_TO_ROUTE[parsed.resource];
  if (!segment) return;
  const inviteQuery = parsed.kind === 'invite' ? '?intent=join' : '';
  router.replace(`/${segment}/${parsed.id}${inviteQuery}` as never);
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
