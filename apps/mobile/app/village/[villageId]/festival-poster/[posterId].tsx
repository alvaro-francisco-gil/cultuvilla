import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Screen } from '../../../../components/primitives/Screen';
import { VStack } from '../../../../components/primitives/VStack';
import { Text } from '../../../../components/primitives/Text';
import { DetailHeroImage } from '../../../../components/feature/DetailHeroImage';
import { FloatingBackButton } from '../../../../components/feature/FloatingBackButton';
import { useT } from '../../../../lib/i18n';
import { getFestivalPoster } from '@cultuvilla/shared/services/festivalPosterService';
import type { FestivalPosterWithId } from '@cultuvilla/shared/services/festivalPosterService';
import { formatFestivalPosterDates } from '@cultuvilla/shared/utils';

export default function FestivalPosterDetailScreen() {
  const { posterId } = useLocalSearchParams<{ villageId: string; posterId: string }>();
  const { t } = useT();
  const [poster, setPoster] = useState<FestivalPosterWithId | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!posterId) return;
    try {
      setPoster(await getFestivalPoster(posterId));
    } finally {
      // On failure `poster` stays null, so the not-found view renders
      // instead of an indefinite spinner.
      setLoading(false);
    }
  }, [posterId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading || !poster) {
    return (
      <Screen padded={false} topInset={false}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center">
          {loading ? <ActivityIndicator /> : <Text>{t('common.notFound')}</Text>}
        </View>
        <FloatingBackButton />
      </Screen>
    );
  }

  const dateLabel = formatFestivalPosterDates(poster);
  const subtitle = [poster.title ? String(poster.year) : null, dateLabel].filter(Boolean).join(' · ');

  return (
    <Screen padded={false} topInset={false}>
      <StatusBar style="light" />
      <ScrollView contentContainerClassName="pb-10">
        <DetailHeroImage imageUri={poster.imageURL} fallbackIcon="image-outline" />
        <FloatingBackButton />
        <VStack gap={2} className="p-4">
          <Text variant="h1">{poster.title ?? String(poster.year)}</Text>
          {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
        </VStack>
      </ScrollView>
    </Screen>
  );
}
