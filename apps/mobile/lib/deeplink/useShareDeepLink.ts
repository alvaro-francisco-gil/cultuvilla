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
export function useShareDeepLink(): (link: DeepLink, name: string) => Promise<void> {
  const { t } = useT();
  return useCallback(
    async (link: DeepLink, name: string) => {
      const message = buildShareMessage(link, t, name);
      try {
        // `message` already embeds the URL (buildShareMessage interpolates it).
        // Passing a separate `url` too makes the Web Share API + iOS render the
        // link twice ("two links in one message"); Android only ever used
        // `message`, so message-only is one link on every platform.
        await Share.share({ message });
      } catch {
        // No-op: user dismissed, or Web Share API unavailable.
      }
    },
    [t],
  );
}
