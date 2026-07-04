import { useEffect, useState, type ReactNode } from 'react';
import { View, Linking } from 'react-native';
import { getAppVersionConfig, resolveVersionGate, type GateDecision } from '@cultuvilla/shared';
import { Pressable, Text } from './primitives';
import { getRunningVersion, getGatePlatform } from '../lib/appVersion';
import { useT } from '../lib/i18n';

export function AppVersionGate({ children }: { children: ReactNode }) {
  const { t } = useT();
  const [decision, setDecision] = useState<GateDecision | 'loading'>('loading');
  const [storeUrl, setStoreUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const platform = getGatePlatform();
      const config = await getAppVersionConfig();
      if (!active) return;
      setDecision(resolveVersionGate(getRunningVersion(), config, platform));
      if (config && platform !== 'web') setStoreUrl(config.storeUrl[platform]);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Fail open: while resolving (and on 'ok'/'loading') we render children. The
  // full-screen blocker only appears once we KNOW the client is too old.
  if (decision === 'block') {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-surface p-6">
        <Text variant="h2" className="text-center">
          {t('appUpdate.blockTitle')}
        </Text>
        <Text className="text-center">{t('appUpdate.blockBody')}</Text>
        {storeUrl ? (
          <Pressable
            className="rounded-md bg-accent px-4 py-2"
            onPress={() => void Linking.openURL(storeUrl)}
          >
            <Text tone="onAccent">{t('appUpdate.cta')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <>
      {decision === 'nudge' ? (
        <Pressable
          className="bg-accent px-4 py-2"
          onPress={() => storeUrl && Linking.openURL(storeUrl)}
        >
          <Text tone="onAccent" className="text-center">
            {t('appUpdate.nudge')} {t('appUpdate.cta')}
          </Text>
        </Pressable>
      ) : null}
      {children}
    </>
  );
}
