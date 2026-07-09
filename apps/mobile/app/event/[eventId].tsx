import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Alert, Linking, Platform } from 'react-native';
import { VStack } from '../../components/primitives/VStack';
import { HStack } from '../../components/primitives/HStack';
import { Text } from '../../components/primitives/Text';
import { Button } from '../../components/primitives/Button';
import { LiveOwnerChip } from '../../components/feature/LiveOwnerChip';
import { RegisterFab } from '../../components/feature/RegisterFab';
import { EventAttendees } from '../../components/feature/EventAttendees';
import { useEventOrganizer } from '../../lib/events/useEventOrganizer';
import { EntityDetailScaffold } from '../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../components/feature/EntityDetailHeader';
import { DetailInfoCard } from '../../components/feature/DetailInfoCard';
import { ENTITY_FALLBACK_ICON } from '../../lib/entities/registry';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { getEvent, updateEventStatus } from '@cultuvilla/shared/services/eventService';
import { getEventLink } from '@cultuvilla/shared/services/deepLinkService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person/PersonDataModel';
import { formatDate, buildGoogleCalendarUrl } from '@cultuvilla/shared/utils';
import { useT } from '../../lib/i18n';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';
import type { PersonData } from '@cultuvilla/shared/models/person/PersonDataModel';

type EventDoc = EventData & { id: string };
type PersonDoc = PersonData & { id: string };

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { user } = useAuth();
  const gate = useRegisterGate();
  const { t } = useT();
  const share = useShareDeepLink();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [person, setPerson] = useState<PersonDoc | null>(null);
  const { canOrganize } = useEventOrganizer(event);

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

  const cancelEvent = () => {
    if (!event) return;
    const doCancel = () => {
      void updateEventStatus(event.id, 'cancelled').then(() => {
        if (router.canGoBack()) router.back();
      });
    };
    // Alert.alert is a no-op on RN-Web, so branch to window.confirm there.
    if (Platform.OS === 'web') {
      if (window.confirm(t('event.cancelConfirm'))) doCancel();
      return;
    }
    Alert.alert(t('event.cancelTitle'), t('event.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('event.cancelTitle'), style: 'destructive', onPress: doCancel },
    ]);
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
              {
                icon: 'trash-outline' as const,
                accessibilityLabel: t('event.cancelTitle'),
                onPress: cancelEvent,
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
              <Text tone="muted">{t('event.organizersLabel')}</Text>
              {event.organizerOrgIds?.map((id) => (
                <LiveOwnerChip key={id} ownerType="organization" ownerId={id} />
              ))}
              {event.organizerUserIds?.map((id) => (
                <LiveOwnerChip key={id} ownerType="user" ownerId={id} />
              ))}
            </VStack>
          )}
          {event.description ? <Text>{event.description}</Text> : null}
          {canOrganize ? (
            <EventAttendees eventId={event.id} telephoneRequired={!!event.telephoneRequired} />
          ) : null}
          {!user && (
            <Button variant="primary" fullWidth onPress={() => gate.requireAuth(`/event/${event.id}`, t('guest.event'))}>
              {t('guest.eventCta')}
            </Button>
          )}
          {!person && user ? <Text tone="muted">{t('event.register.needsPerson')}</Text> : null}
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
