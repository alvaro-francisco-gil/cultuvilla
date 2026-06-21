import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Screen } from '../../../../components/primitives/Screen';
import { VStack } from '../../../../components/primitives/VStack';
import { Text } from '../../../../components/primitives/Text';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { PersonCard } from '../../../../components/feature/VillageSections';
import { useT } from '../../../../lib/i18n';
import { getBarrio } from '@cultuvilla/shared/services/municipalityService';
import { getPersonsByBarrio } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person';
import type { BarrioData } from '@cultuvilla/shared/models/municipality';
import type { PersonData } from '@cultuvilla/shared/models/person';

type Barrio = BarrioData & { id: string };
type Person = PersonData & { id: string };

export default function BarrioDetailScreen() {
  const { villageId, barrioId } = useLocalSearchParams<{ villageId: string; barrioId: string }>();
  const { t } = useT();
  const [barrio, setBarrio] = useState<Barrio | null>(null);
  const [residents, setResidents] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!villageId || !barrioId) return;
    void (async () => {
      const [b, people] = await Promise.all([
        getBarrio(villageId, barrioId),
        getPersonsByBarrio(villageId, barrioId),
      ]);
      setBarrio(b);
      setResidents(people);
      setLoading(false);
    })();
  }, [villageId, barrioId]);

  return (
    <Screen padded={false}>
      <ScreenHeader title={barrio?.name ?? ''} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : !barrio ? (
        <View className="p-4">
          <Text>{t('common.notFound')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="pb-10">
          {barrio.imageURL ? (
            <Image source={{ uri: barrio.imageURL }} className="w-full h-40" resizeMode="cover" />
          ) : null}
          <VStack gap={3} className="p-4">
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
      )}
    </Screen>
  );
}
