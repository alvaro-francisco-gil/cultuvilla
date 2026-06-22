import { useEffect } from 'react';
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
