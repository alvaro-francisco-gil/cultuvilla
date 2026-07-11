import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Linking, View } from 'react-native';
import { VStack } from '../../components/primitives/VStack';
import { HStack } from '../../components/primitives/HStack';
import { Text } from '../../components/primitives/Text';
import { Button } from '../../components/primitives/Button';
import { Avatar } from '../../components/primitives/Avatar';
import { Pressable } from '../../components/primitives/Pressable';
import { LiveOwnerChip } from '../../components/feature/LiveOwnerChip';
import { RegisterFab } from '../../components/feature/RegisterFab';
import { EventAttendees } from '../../components/feature/EventAttendees';
import { DetailSectionHeading } from '../../components/feature/DetailSectionHeading';
import { useEventOrganizer } from '../../lib/events/useEventOrganizer';
import { EntityDetailScaffold } from '../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../components/feature/EntityDetailHeader';
import { DetailInfoCard } from '../../components/feature/DetailInfoCard';
import { EntityComments } from '../../components/feature/EntityComments';
import { ENTITY_FALLBACK_ICON } from '../../lib/entities/registry';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
import { useEntityCapabilities } from '../../lib/auth/useEntityCapabilities';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { getEvent } from '@cultuvilla/shared/services/eventService';
import { recordEntityView } from '@cultuvilla/shared/services/commentsService';
import { getEventLink } from '@cultuvilla/shared/services/deepLinkService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { escudoThumbDisplayUrl } from '@cultuvilla/shared/models/municipality';
import { buildDisplayName } from '@cultuvilla/shared/models/person/PersonDataModel';
import { formatDate, buildGoogleCalendarUrl } from '@cultuvilla/shared/utils';
import { useT } from '../../lib/i18n';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';
import type { PersonData } from '@cultuvilla/shared/models/person/PersonDataModel';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';

type EventDoc = EventData & { id: string };
type PersonDoc = PersonData & { id: string };
type VillageDoc = MunicipalityData & { id: string };

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const gate = useRegisterGate();
  const { t } = useT();
  const share = useShareDeepLink();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [person, setPerson] = useState<PersonDoc | null>(null);
  const [village, setVillage] = useState<VillageDoc | null>(null);
  const { canOrganize } = useEventOrganizer(event);
  const { canManage } = useEntityCapabilities(event?.municipalityId);

  useEffect(() => {
    if (!eventId) return;
    void (async () => {
      setEvent(await getEvent(eventId));
    })();
  }, [eventId]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setPerson(await getPersonByUserId(user.uid));
    })();
  }, [user]);

  // The escudo lives on the municipality doc, not the event; fetch it once the
  // event (and its municipalityId) is loaded to render the Pueblo section.
  useEffect(() => {
    const municipalityId = event?.municipalityId;
    if (!municipalityId) return;
    void (async () => {
      setVillage(await getMunicipality(municipalityId));
    })();
  }, [event?.municipalityId]);

  useEffect(() => {
    if (!event) return;
    void recordEntityView({ entityKind: 'event', entityId: event.id, municipalityId: event.municipalityId });
  }, [event?.id]);

  const personName = person ? buildDisplayName(person) : '';

  const openInMaps = () => {
    const c = event?.location?.coordinates;
    if (!c) return;
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`,
    ).catch(() => {});
  };

  const addToCalendar = () => {
    if (!event) return;
    void Linking.openURL(
      buildGoogleCalendarUrl({
        title: event.title,
        start: event.startDate,
        end: event.endDate,
        details: event.description,
        location: event.location?.displayName,
      }),
    ).catch(() => {});
  };

  const actions: EntityDetailAction[] = event
    ? [
        ...(canOrganize
          ? [
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('event.editEvent'),
                onPress: () => router.push(`/event/new?eventId=${event.id}` as never),
              },
            ]
          : []),
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getEventLink(event.id), event.title),
        },
      ]
    : [];

  return (
    <EntityDetailScaffold
      loading={!event}
      imageUri={event?.imageURL ?? null}
      fallbackImageUri={event?.villageCoverImage ?? null}
      fallbackIcon={ENTITY_FALLBACK_ICON.event}
      actions={actions}
      title={event?.title}
      scrollContentClassName="pb-24"
      fab={
        event && person && user ? (
          <RegisterFab
            eventId={event.id}
            userId={user.uid}
            personId={person.id}
            name={personName}
            telephoneRequired={!!event.telephoneRequired}
            villageId={event.municipalityId}
          />
        ) : null
      }
    >
      {event ? (
        <>
          <HStack gap={3} align="stretch">
            <DetailInfoCard
              icon="calendar-outline"
              label={t('event.date')}
              value={`${formatDate(event.startDate, 'dayMonth')} · ${formatDate(event.startDate, 'time')}`}
              onPress={addToCalendar}
            />
            {event.location ? (
              <DetailInfoCard
                icon="location-outline"
                label={t('event.location')}
                value={event.location.displayName}
                onPress={openInMaps}
              />
            ) : null}
          </HStack>
          {(event.organizerUserIds?.length > 0 || event.organizerOrgIds?.length > 0) && (
            <VStack gap={2}>
              <DetailSectionHeading>{t('event.organizersLabel')}</DetailSectionHeading>
              <View className="flex-row flex-wrap items-center" style={{ gap: 12 }}>
                {event.organizerOrgIds?.map((id) => (
                  <LiveOwnerChip
                    key={id}
                    ownerType="organization"
                    ownerId={id}
                    onPress={() => router.push(`/o/${id}` as never)}
                  />
                ))}
                {event.organizerUserIds?.map((id) => (
                  <LiveOwnerChip
                    key={id}
                    ownerType="user"
                    ownerId={id}
                    onPress={() => router.push(`/user/${id}` as never)}
                  />
                ))}
              </View>
            </VStack>
          )}
          {event.villageName ? (
            <VStack gap={2}>
              <DetailSectionHeading>{t('event.villageLabel')}</DetailSectionHeading>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/village/[villageId]',
                    params: { villageId: event.municipalityId },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={event.villageName}
              >
                <HStack gap={2} align="center">
                  <Avatar
                    uri={village ? escudoThumbDisplayUrl(village) : null}
                    size={36}
                    initials={event.villageName.slice(0, 1).toUpperCase()}
                  />
                  <Text numberOfLines={1} className="shrink">
                    {event.villageName}
                  </Text>
                </HStack>
              </Pressable>
            </VStack>
          ) : null}
          {event.description ? (
            <VStack gap={2}>
              <DetailSectionHeading>{t('event.descriptionLabel')}</DetailSectionHeading>
              <Text>{event.description}</Text>
            </VStack>
          ) : null}
          {canOrganize ? (
            <EventAttendees eventId={event.id} telephoneRequired={!!event.telephoneRequired} />
          ) : null}
          {!user && (
            <Button variant="primary" fullWidth onPress={() => gate.requireAuth(`/event/${event.id}`, t('guest.event'))}>
              {t('guest.eventCta')}
            </Button>
          )}
          {!person && user ? <Text tone="muted">{t('event.register.needsPerson')}</Text> : null}
          <EntityComments
            key={event.id}
            entityKind="event"
            entityId={event.id}
            municipalityId={event.municipalityId}
            canModerate={canManage}
          />
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
