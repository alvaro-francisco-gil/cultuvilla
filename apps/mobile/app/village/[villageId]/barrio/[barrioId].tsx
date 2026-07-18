import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Text } from '../../../../components/primitives/Text';
import { VStack } from '../../../../components/primitives/VStack';
import { NaturalImage } from '../../../../components/primitives/NaturalImage';
import { EntityDetailScaffold } from '../../../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../../../components/feature/EntityDetailHeader';
import { ENTITY_FALLBACK_ICON } from '../../../../lib/entities/registry';
import { LivePersonChip } from '../../../../components/feature/LivePersonChip';
import { EntityComments } from '../../../../components/feature/EntityComments';
import { useT } from '../../../../lib/i18n';
import { useShareDeepLink } from '../../../../lib/deeplink/useShareDeepLink';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
import { getBarrio } from '@cultuvilla/shared/services/municipalityService';
import { recordEntityView } from '@cultuvilla/shared/services/commentsService';
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

  useEffect(() => {
    if (!barrio) return;
    void recordEntityView({ entityKind: 'barrio', entityId: barrio.id, municipalityId: barrio.municipalityId });
  }, [barrio?.id]);

  const actions: EntityDetailAction[] = barrio
    ? [
        ...(canManage
          ? [
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('common.edit'),
                onPress: () => router.push(`/village/${villageId}/barrio/${barrio.id}/edit` as never),
              },
            ]
          : []),
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getBarrioViewLink(villageId, barrio.id), barrio.name),
        },
      ]
    : [];

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !barrio}
      imageUri={barrio?.images[0] ?? null}
      fallbackIcon={ENTITY_FALLBACK_ICON.barrio}
      actions={actions}
      title={barrio?.name}
      onRefresh={load}
    >
      {barrio ? (
        <>
          {barrio.images.length > 1 ? (
            <VStack gap={2} className="pt-2">
              {barrio.images.slice(1).map((uri) => (
                <NaturalImage key={uri} uri={uri} />
              ))}
            </VStack>
          ) : null}
          <Text variant="h2">{t('village.barrioDetail.residents')}</Text>
          {residents.length === 0 ? (
            <Text tone="muted" variant="bodySm">
              {t('village.barrioDetail.residentsEmpty')}
            </Text>
          ) : (
            <View className="flex-row flex-wrap items-center" style={{ gap: 12 }}>
              {residents.map((p) => (
                <LivePersonChip
                  key={p.id}
                  personId={p.id}
                  fallbackName={buildDisplayName(p)}
                  onPress={() => router.push(`/person/${p.id}` as never)}
                />
              ))}
            </View>
          )}
          <EntityComments
            key={barrio.id}
            entityKind="barrio"
            entityId={barrio.id}
            municipalityId={barrio.municipalityId}
            canModerate={canManage}
          />
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
