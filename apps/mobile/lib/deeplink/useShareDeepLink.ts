import { useCallback } from 'react';
import { Share } from 'react-native';
import {
  buildShareMessage,
  type DeepLink,
} from '@cultuvilla/shared/services/deepLinkService';
import { useT } from '../i18n';

/**
 * Returns a function that opens the OS share sheet for a deeplink.
 * Falls back silently if the platform (e.g. some web browsers without the
 * Web Share API) cannot present a share UI.
 */
export function useShareDeepLink(): (link: DeepLink) => Promise<void> {
  const { t } = useT();
  return useCallback(
    async (link: DeepLink) => {
      const message = buildShareMessage(link, t);
      try {
        await Share.share({ message, url: link.url });
      } catch {
        // No-op: user dismissed, or Web Share API unavailable.
      }
    },
    [t],
  );
}
