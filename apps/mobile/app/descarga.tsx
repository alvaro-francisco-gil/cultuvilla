import { Platform, Linking } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Screen, VStack, Text, Button } from '../components/primitives';
import { useT } from '../lib/i18n';
import { APP_AVAILABLE, APP_STORES } from '../lib/appStores';

export default function Descarga() {
  const { t } = useT();
  const router = useRouter();

  // On native, the user is already in the app — this route only exists so the
  // shared app/ tree compiles; send them home.
  if (Platform.OS !== 'web') {
    return <Redirect href="/(tabs)" />;
  }

  const openWeb = () => router.replace('/(tabs)');

  return (
    <Screen>
      <VStack gap={6} className="flex-1 items-center justify-center px-6">
        <Text variant="h1" tone="primary">Cultuvilla</Text>
        <Text tone="muted" className="text-center">{t('descarga.tagline')}</Text>

        <Button onPress={openWeb} variant="primary" size="lg" fullWidth>
          {t('descarga.openWeb')}
        </Button>

        {APP_AVAILABLE ? (
          <VStack gap={3} className="w-full">
            {APP_STORES.ios ? (
              <Button onPress={() => Linking.openURL(APP_STORES.ios)} variant="secondary" fullWidth>
                {t('descarga.getOnAppStore')}
              </Button>
            ) : null}
            {APP_STORES.android ? (
              <Button onPress={() => Linking.openURL(APP_STORES.android)} variant="secondary" fullWidth>
                {t('descarga.getOnPlayStore')}
              </Button>
            ) : null}
          </VStack>
        ) : (
          <Text variant="caption" tone="muted" className="text-center">{t('descarga.comingSoon')}</Text>
        )}
      </VStack>
    </Screen>
  );
}
