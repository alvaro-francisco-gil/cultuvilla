import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Text } from '../../../../components/primitives/Text';
import { VStack } from '../../../../components/primitives/VStack';
import { HStack } from '../../../../components/primitives/HStack';
import { Avatar } from '../../../../components/primitives/Avatar';
import { Pressable } from '../../../../components/primitives/Pressable';
import { NaturalImage } from '../../../../components/primitives/NaturalImage';
import { EntityDetailScaffold } from '../../../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../../../components/feature/EntityDetailHeader';
import { ENTITY_FALLBACK_ICON } from '../../../../lib/entities/registry';
import { DetailSectionHeading } from '../../../../components/feature/DetailSectionHeading';
import { EntityComments } from '../../../../components/feature/EntityComments';
import { useT } from '../../../../lib/i18n';
import { useShareDeepLink } from '../../../../lib/deeplink/useShareDeepLink';
import { useAuth } from '../../../../lib/auth/useAuth';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
import { observability, OBSERVABILITY_EVENTS } from '@cultuvilla/shared';
import { getBarrio } from '@cultuvilla/shared/services/municipalityService';
import { recordEntityView } from '@cultuvilla/shared/services/commentsService';
import { getBarrioViewLink } from '@cultuvilla/shared/services/deepLinkService';
import { getPersonsByBarrio } from '@cultuvilla/shared/services/personService';
import { buildNameWithNickname, isDeceased } from '@cultuvilla/shared/models/person';
import type { BarrioData } from '@cultuvilla/shared/models/municipality';
import type { PersonData } from '@cultuvilla/shared/models/person';

type Barrio = BarrioData & { id: string };
type Person = PersonData & { id: string };

export default function BarrioDetailScreen() {
  const { villageId, barrioId } = useLocalSearchParams<{ villageId: string; barrioId: string }>();
  const { t } = useT();
  const { user } = useAuth();
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
      // Deceased residents live in the cemetery view, not the barrio roster.
      setResidents(people.filter((person) => !isDeceased(person)));
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
    observability.trackEvent(OBSERVABILITY_EVENTS.CONTENT_DETAIL_VIEWED, {
      entityKind: 'barrio',
      entityId: barrio.id,
      municipalityId: barrio.municipalityId,
    });
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
          <DetailSectionHeading>{t('village.barrioDetail.residents')}</DetailSectionHeading>
          {residents.length === 0 ? (
            <Text tone="muted" variant="bodySm">
              {t('village.barrioDetail.residentsEmpty')}
            </Text>
          ) : (
            <VStack>
              {residents.map((p) => {
                const name = buildNameWithNickname(p);
                const onPress = p.userId
                  ? () =>
                      router.push(
                        (p.userId === user?.uid ? '/(tabs)/profile' : `/user/${p.userId}`) as never,
                      )
                  : undefined;
                const row = (
                  <HStack gap={2} className="items-center py-3 border-b border-subtle">
                    <Avatar uri={p.photoURL} size={32} initials={name.slice(0, 1).toUpperCase()} />
                    <Text numberOfLines={1} className="flex-1">
                      {name}
                    </Text>
                  </HStack>
                );
                return onPress ? (
                  <Pressable key={p.id} onPress={onPress} accessibilityRole="button" accessibilityLabel={name}>
                    {row}
                  </Pressable>
                ) : (
                  <View key={p.id}>{row}</View>
                );
              })}
            </VStack>
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
