import { useEffect } from 'react';
import { Platform, Linking } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { resolveStorePlatform } from '@cultuvilla/shared';
import { Screen, VStack, Text, Button } from '../components/primitives';
import { useT } from '../lib/i18n';
import { APP_STORES } from '@cultuvilla/shared/config';

// /descarga is the URL printed on the QR, so a phone should land in its store
// with no page in between. Desktop has nothing to install, and a phone whose
// platform has no listing would otherwise hit a dead end — both get the picker.
function resolveStoreUrl(): string | null {
  if (typeof navigator === 'undefined') return null;
  const platform = resolveStorePlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  return platform ? APP_STORES[platform] || null : null;
}

export default function Descarga() {
  const { t } = useT();
  const router = useRouter();
  const isWeb = Platform.OS === 'web';
  const storeUrl = isWeb ? resolveStoreUrl() : null;

  useEffect(() => {
    // replace, not assign: Back from the store must not bounce into this redirect again.
    if (storeUrl) globalThis.location.replace(storeUrl);
  }, [storeUrl]);

  // On native the visitor already has the app.
  if (!isWeb) return <Redirect href="/(tabs)" />;
  if (storeUrl) return null;

  return (
    <Screen>
      <VStack gap={6} className="flex-1 items-center justify-center px-6">
        <Text variant="h1" tone="primary">Cultuvilla</Text>
        <Text tone="muted" className="text-center">{t('descarga.tagline')}</Text>

        <VStack gap={3} className="w-full">
          {APP_STORES.ios ? (
            <Button onPress={() => Linking.openURL(APP_STORES.ios)} variant="primary" size="lg" fullWidth>
              {t('descarga.getOnAppStore')}
            </Button>
          ) : null}
          {APP_STORES.android ? (
            <Button onPress={() => Linking.openURL(APP_STORES.android)} variant="primary" size="lg" fullWidth>
              {t('descarga.getOnPlayStore')}
            </Button>
          ) : null}
          <Button onPress={() => router.replace('/(tabs)')} variant="ghost" fullWidth>
            {t('descarga.continueOnWeb')}
          </Button>
        </VStack>
      </VStack>
    </Screen>
  );
}
