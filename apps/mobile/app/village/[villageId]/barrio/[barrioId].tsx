import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Screen } from '../../../../components/primitives/Screen';
import { VStack } from '../../../../components/primitives/VStack';
import { Text } from '../../../../components/primitives/Text';
import { DetailHeroImage } from '../../../../components/feature/DetailHeroImage';
import { FloatingBackButton } from '../../../../components/feature/FloatingBackButton';
import { FloatingShareButton } from '../../../../components/feature/FloatingShareButton';
import { FloatingEditButton } from '../../../../components/feature/FloatingEditButton';
import { PersonCard } from '../../../../components/feature/VillageSections';
import { useT } from '../../../../lib/i18n';
import { useShareDeepLink } from '../../../../lib/deeplink/useShareDeepLink';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
import { getBarrio } from '@cultuvilla/shared/services/municipalityService';
import { getBarrioViewLink } from '@cultuvilla/shared/services/deepLinkService';
import { getPersonsByBarrio } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import type { BarrioData } from '@cultuvilla/shared/models/municipality';
import type { PersonData } from '@cultuvilla/shared/models/person';

type Barrio = BarrioData & { id: string };
type Person = PersonData & { id: string };

export default function BarrioDetailScreen() {
  const { villageId, barrioId } = useLocalSearchParams<{ villageId: string; barrioId: string }>();
  const { t } = useT();
  const share = useShareDeepLink();
  const { canManage } = useEntityCapabilities(villageId);
  const [barrio, setBarrio] = useState<Barrio | null>(null);
  const [residents, setResidents] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!villageId || !barrioId) return;
    try {
      const [b, people] = await Promise.all([
        getBarrio(villageId, barrioId),
        getPersonsByBarrio(villageId, barrioId),
      ]);
      setBarrio(b);
      setResidents(people);
    } finally {
      // On failure `barrio` stays null, so the not-found view renders
      // instead of an indefinite spinner.
      setLoading(false);
    }
  }, [villageId, barrioId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading || !barrio) {
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

  return (
    <Screen padded={false} topInset={false}>
      <StatusBar style="light" />
      <ScrollView contentContainerClassName="pb-10">
        <DetailHeroImage imageUri={barrio.imageURL} fallbackIcon="map-outline" />
        <FloatingBackButton />
        <FloatingShareButton
          onPress={() => void share(getBarrioViewLink(villageId, barrio.id), barrio.name)}
        />
        {canManage ? (
          <FloatingEditButton
            onPress={() => router.push(`/village/${villageId}/barrio/${barrio.id}/edit` as never)}
          />
        ) : null}
        <VStack gap={3} className="p-4">
          <Text variant="h1">{barrio.name}</Text>
          <Text variant="h2">{t('village.barrioDetail.residents')}</Text>
          {residents.length === 0 ? (
            <Text tone="muted" variant="bodySm">
              {t('village.barrioDetail.residentsEmpty')}
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
              {residents.map((p) => (
                <PersonCard
                  key={p.id}
                  name={buildDisplayName(p)}
                  photoURL={p.photoURL}
                  onPress={() => router.push(`/person/${p.id}` as never)}
                />
              ))}
            </ScrollView>
          )}
        </VStack>
      </ScrollView>
    </Screen>
  );
}
