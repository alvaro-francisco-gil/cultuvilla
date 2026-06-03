import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import {
  parseLink,
  type DeepLinkResource,
} from '@cultuvilla/shared/services/deepLinkService';

const RESOURCE_TO_ROUTE: Record<DeepLinkResource, string> = {
  event: 'event',
  news: 'news',
  village: 'village',
  organization: 'o',
};

function route(url: string): void {
  const parsed = parseLink(url);
  if (!parsed) return;
  const segment = RESOURCE_TO_ROUTE[parsed.resource];
  router.replace(`/${segment}/${parsed.id}` as never);
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
