import { useCallback, useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isStoreBannerDismissed,
  resolveStorePlatform,
  type StoreBannerDismissal,
  type StorePlatform,
} from '@cultuvilla/shared';
import { iconSizes } from '@cultuvilla/shared/design-system';
import { Button, HStack, Pressable, Text, VStack } from './primitives';
import { APP_STORES } from '../lib/appStores';
import { isWeb } from '../lib/platform';
import { useT } from '../lib/i18n';

const DISMISSAL_KEY = 'cultuvilla:storeBanner:dismissal';

async function readDismissal(): Promise<StoreBannerDismissal | null> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSAL_KEY);
    return raw ? (JSON.parse(raw) as StoreBannerDismissal) : null;
  } catch {
    return null;
  }
}

/**
 * Which store, if any, to offer this visitor. Web-only by construction: on a
 * native build the visitor already has the app, and `navigator` doesn't exist.
 * Returns null when we have no listing for the detected platform, which is what
 * keeps the banner dormant until each `APP_STORES` URL is filled in at release
 * (iOS and Android light up independently — see lib/appStores.ts).
 */
function resolveOffer(): { platform: StorePlatform; url: string } | null {
  if (!isWeb || typeof navigator === 'undefined') return null;
  const platform = resolveStorePlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  if (!platform) return null;
  const url = APP_STORES[platform];
  return url ? { platform, url } : null;
}

/**
 * "Get the app" bar shown to iOS/Android visitors of the web build.
 *
 * Rendered as a flex sibling ABOVE the navigator rather than as an overlay, so
 * it pushes content down the way Safari's own smart app banner does. An
 * absolutely-positioned bar would have to dodge the tab bar on tab routes and
 * the entity detail header on the rest; a sibling collides with neither.
 *
 * Dismissal is a 30-day cooldown, not a permanent opt-out — see
 * `isStoreBannerDismissed`.
 */
export function SmartAppBanner() {
  const { t } = useT();
  const [offer] = useState(resolveOffer);
  // `null` = not yet read from storage. Rendering nothing until the read
  // resolves avoids a flash of banner that then disappears on a dismissed
  // visitor's every page load.
  const [dismissed, setDismissed] = useState<boolean | null>(offer ? null : true);

  useEffect(() => {
    if (!offer) return;
    let active = true;
    void readDismissal().then((record) => {
      if (active) setDismissed(isStoreBannerDismissed(record, Date.now()));
    });
    return () => {
      active = false;
    };
  }, [offer]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    const record: StoreBannerDismissal = { dismissedAt: Date.now() };
    // A failed write only means we offer again next visit — never worth crashing.
    void AsyncStorage.setItem(DISMISSAL_KEY, JSON.stringify(record)).catch(() => {});
  }, []);

  const open = useCallback(() => {
    if (offer) void Linking.openURL(offer.url);
  }, [offer]);

  if (!offer || dismissed !== false) return null;

  return (
    <View className="border-b border-subtle bg-surface-elevated px-4 py-3" testID="smart-app-banner">
      <HStack gap={3} className="items-center">
        <Pressable
          onPress={dismiss}
          className="p-1"
          testID="smart-app-banner-dismiss"
          accessibilityRole="button"
          accessibilityLabel={t('smartBanner.dismiss')}
        >
          <Ionicons name="close" size={iconSizes.md} />
        </Pressable>
        <VStack gap={0} className="flex-1">
          <Text variant="body" className="font-semibold">
            {t('smartBanner.title')}
          </Text>
          <Text variant="caption" tone="muted">
            {t(offer.platform === 'ios' ? 'smartBanner.subtitleIos' : 'smartBanner.subtitleAndroid')}
          </Text>
        </VStack>
        <Button onPress={open} size="md" testID="smart-app-banner-cta">
          {t('smartBanner.cta')}
        </Button>
      </HStack>
    </View>
  );
}
