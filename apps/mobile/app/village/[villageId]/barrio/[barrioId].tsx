import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Text } from '../../../../components/primitives/Text';
import { VStack } from '../../../../components/primitives/VStack';
import { EntityDetailScaffold } from '../../../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../../../components/feature/EntityDetailHeader';
import { ENTITY_FALLBACK_ICON } from '../../../../lib/entities/registry';
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
      setLoading(false);
    }
  }, [villageId, barrioId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const actions: EntityDetailAction[] = barrio
    ? [
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getBarrioViewLink(villageId, barrio.id), barrio.name),
        },
        ...(canManage
          ? [
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('common.edit'),
                onPress: () => router.push(`/village/${villageId}/barrio/${barrio.id}/edit` as never),
              },
            ]
          : []),
      ]
    : [];

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !barrio}
      imageUri={barrio?.imageURL ?? null}
      fallbackIcon={ENTITY_FALLBACK_ICON.barrio}
      actions={actions}
      title={barrio?.name}
    >
      {barrio ? (
        <>
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
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
