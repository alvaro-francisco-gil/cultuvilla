import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Text } from '../../../../components/primitives/Text';
import { VStack } from '../../../../components/primitives/VStack';
import { NaturalImage } from '../../../../components/primitives/NaturalImage';
import { EntityDetailScaffold } from '../../../../components/feature/EntityDetailScaffold';
import { BuryFab } from '../../../../components/feature/BuryFab';
import type { EntityDetailAction } from '../../../../components/feature/EntityDetailHeader';
import { ENTITY_FALLBACK_ICON } from '../../../../lib/entities/registry';
import { LivePersonChip } from '../../../../components/feature/LivePersonChip';
import { DetailSectionHeading } from '../../../../components/feature/DetailSectionHeading';
import { EntityComments } from '../../../../components/feature/EntityComments';
import { useT } from '../../../../lib/i18n';
import { useShareDeepLink } from '../../../../lib/deeplink/useShareDeepLink';
import { useEntityCapabilities } from '../../../../lib/auth/useEntityCapabilities';
import { getPlace } from '@cultuvilla/shared/services/municipalityService';
import { recordEntityView } from '@cultuvilla/shared/services/commentsService';
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
  const { canManage, uid } = useEntityCapabilities(villageId);

  const load = useCallback(async () => {
    if (!villageId || !placeId) return;
    try {
      const p = await getPlace(villageId, placeId);
      setPlace(p);
      if (p?.kind === 'cemetery') {
        setBuried(await getPersonsByBurialPlace(placeId));
      }
    } finally {
      setLoading(false);
    }
  }, [villageId, placeId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!place) return;
    void recordEntityView({ entityKind: 'place', entityId: place.id, municipalityId: place.municipalityId });
  }, [place?.id]);

  const actions: EntityDetailAction[] = place
    ? [
        ...(canManage
          ? [
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('common.edit'),
                onPress: () => router.push(`/village/${villageId}/place/${place.id}/edit` as never),
              },
            ]
          : []),
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getPlaceViewLink(villageId, place.id), place.name),
        },
      ]
    : [];

  return (
    <>
      <EntityDetailScaffold
        loading={loading}
        notFound={!loading && !place}
        imageUri={place?.images[0] ?? null}
        fallbackIcon={ENTITY_FALLBACK_ICON.place}
        actions={actions}
        title={place?.name}
        onRefresh={load}
      >
        {place ? (
        <>
          <Text tone="muted" variant="bodySm">
            {t(`village.admin.places.kind.${place.kind}` as never)}
          </Text>
          {place.description ? <Text>{place.description}</Text> : null}
          {place.images.length > 1 ? (
            <VStack gap={2} className="pt-2">
              {place.images.slice(1).map((uri) => (
                <NaturalImage key={uri} uri={uri} />
              ))}
            </VStack>
          ) : null}
          {place.kind === 'cemetery' ? (
            <VStack gap={3}>
              <DetailSectionHeading>{t('village.placeDetail.buried')}</DetailSectionHeading>
              {buried.length === 0 ? (
                <Text tone="muted" variant="bodySm">
                  {t('village.placeDetail.buriedEmpty')}
                </Text>
              ) : (
                <View className="flex-row flex-wrap items-center" style={{ gap: 12 }}>
                  {buried.map((p) => (
                    <LivePersonChip
                      key={p.id}
                      personId={p.id}
                      fallbackName={buildDisplayName(p)}
                      onPress={() =>
                        router.push(
                          (p.userId === uid
                            ? '/(tabs)/profile'
                            : p.userId
                              ? `/user/${p.userId}`
                              : `/person/${p.id}`) as never,
                        )
                      }
                    />
                  ))}
                </View>
              )}
            </VStack>
          ) : null}
          <EntityComments
            key={place.id}
            entityKind="place"
            entityId={place.id}
            municipalityId={place.municipalityId}
            canModerate={canManage}
          />
        </>
      ) : null}
      </EntityDetailScaffold>
      {place && place.kind === 'cemetery' && uid && villageId ? (
        <BuryFab
          municipalityId={place.municipalityId}
          placeId={place.id}
          userId={uid}
          buriedHereIds={buried.map((p) => p.id)}
          onChanged={load}
        />
      ) : null}
    </>
  );
}
