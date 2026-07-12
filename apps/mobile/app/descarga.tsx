import { Platform, Linking } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Screen, VStack, Text, Button } from '../components/primitives';
import { useT } from '../lib/i18n';
import { APP_AVAILABLE, APP_STORES } from '../lib/appStores';

export default function Descarga() {
  const { t } = useT();
  const router = useRouter();

  // Pre-release there is no app to download, so /descarga is not a landing page —
  // it forwards straight into the web app (the cultuvilla.es home feed). On native
  // the user is already in the app. The store landing below stays dormant until
  // APP_AVAILABLE flips at release.
  if (!APP_AVAILABLE || Platform.OS !== 'web') {
    return <Redirect href="/(tabs)" />;
  }

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
