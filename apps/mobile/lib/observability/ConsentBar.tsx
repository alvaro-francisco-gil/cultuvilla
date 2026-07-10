import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { observability } from '@cultuvilla/shared';
import { useT } from '../i18n';
import { Text, Button } from '../../components/primitives';

const KEY = 'obs.consent.analytics';

export function ConsentBar(): React.ReactElement | null {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((stored) => {
      if (stored === 'true' || stored === 'false') {
        observability.setConsent({ analytics: stored === 'true' });
      } else {
        setVisible(true);
      }
    });
  }, []);

  async function choose(granted: boolean): Promise<void> {
    observability.setConsent({ analytics: granted });
    await AsyncStorage.setItem(KEY, String(granted));
    setVisible(false);
  }

  if (!visible) return null;
  return (
    <View
      className="absolute left-0 right-0 bottom-0 bg-surface border-t border-border p-4"
      style={{ paddingBottom: insets.bottom + 16 }}
    >
      <Text className="text-body mb-3">{t('consent.message')}</Text>
      <View className="flex-row gap-3">
        <Button onPress={() => void choose(true)}>{t('consent.accept')}</Button>
        <Button variant="secondary" onPress={() => void choose(false)}>{t('consent.decline')}</Button>
      </View>
    </View>
  );
}
