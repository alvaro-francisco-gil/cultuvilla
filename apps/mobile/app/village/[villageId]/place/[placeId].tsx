import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../../components/primitives/Screen';
import { VStack } from '../../../../components/primitives/VStack';
import { Text } from '../../../../components/primitives/Text';
import { DetailHeroImage } from '../../../../components/feature/DetailHeroImage';
import { FloatingBackButton } from '../../../../components/feature/FloatingBackButton';
import { FloatingShareButton } from '../../../../components/feature/FloatingShareButton';
import { PersonCard } from '../../../../components/feature/VillageSections';
import { useT } from '../../../../lib/i18n';
import { useShareDeepLink } from '../../../../lib/deeplink/useShareDeepLink';
import { getPlace } from '@cultuvilla/shared/services/municipalityService';
import { getPlaceViewLink } from '@cultuvilla/shared/services/deepLinkService';
import { getPersonsByBurialPlace } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import type { PlaceData } from '@cultuvilla/shared/models/municipality';
import type { PersonData } from '@cultuvilla/shared/models/person';

type Place = PlaceData & { id: string };
type Person = PersonData & { id: string };

export default function PlaceDetailScreen() {
  const { villageId, placeId } = useLocalSearchParams<{ villageId: string; placeId: string }>();
  const { t } = useT();
  const share = useShareDeepLink();
  const [place, setPlace] = useState<Place | null>(null);
  const [buried, setBuried] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!villageId || !placeId) return;
    void (async () => {
      try {
        const p = await getPlace(villageId, placeId);
        setPlace(p);
        if (p?.kind === 'cemetery') {
          setBuried(await getPersonsByBurialPlace(placeId));
        }
      } finally {
        // On failure `place` stays null, so the not-found view renders
        // instead of an indefinite spinner.
        setLoading(false);
      }
    })();
  }, [villageId, placeId]);

  if (loading || !place) {
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
        <DetailHeroImage imageUri={place.imageURL} fallbackIcon="location-outline" />
        <FloatingBackButton />
        <FloatingShareButton
          onPress={() => void share(getPlaceViewLink(villageId, place.id), place.name)}
        />
        <VStack gap={3} className="p-4">
          <Text variant="h1">{place.name}</Text>
          <Text tone="muted" variant="bodySm">
            {t(`village.admin.places.kind.${place.kind}` as never)}
          </Text>
          {place.description ? <Text>{place.description}</Text> : null}
          {place.kind === 'cemetery' ? (
            <VStack gap={3}>
              <Text variant="h2">{t('village.placeDetail.buried')}</Text>
              {buried.length === 0 ? (
                <Text tone="muted" variant="bodySm">
                  {t('village.placeDetail.buriedEmpty')}
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
                  {buried.map((p) => (
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
          ) : null}
        </VStack>
      </ScrollView>
    </Screen>
  );
}
