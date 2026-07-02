import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Linking, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../../components/primitives/Screen';
import { VStack } from '../../components/primitives/VStack';
import { HStack } from '../../components/primitives/HStack';
import { Text } from '../../components/primitives/Text';
import { Button } from '../../components/primitives/Button';
import { LiveOwnerChip } from '../../components/feature/LiveOwnerChip';
import { RegisterFab } from '../../components/feature/RegisterFab';
import { useEventOrganizer } from '../../lib/events/useEventOrganizer';
import { DetailHeroImage } from '../../components/feature/DetailHeroImage';
import { FloatingBackButton } from '../../components/feature/FloatingBackButton';
import { FloatingShareButton } from '../../components/feature/FloatingShareButton';
import { FloatingEditButton } from '../../components/feature/FloatingEditButton';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { getEvent } from '@cultuvilla/shared/services/eventService';
import { getEventLink } from '@cultuvilla/shared/services/deepLinkService';
import { getPersonByUserId } from '@cultuvilla/shared/services/personService';
import { buildDisplayName } from '@cultuvilla/shared/models/person/PersonDataModel';
import { formatDate } from '@cultuvilla/shared/utils';
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
      const e = await getEvent(eventId);
      setEvent(e);
    })();
  }, [eventId]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const p = await getPersonByUserId(user.uid);
      setPerson(p);
    })();
  }, [user]);

  if (!event) {
    return (
      <Screen padded={false} topInset={false}>
        <StatusBar style="light" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
        <FloatingBackButton />
      </Screen>
    );
  }

  const personName = person ? buildDisplayName(person) : '';

  const openInMaps = () => {
    const c = event.location?.coordinates;
    if (!c) return;
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`,
    ).catch(() => {
      /* best-effort */
    });
  };

  return (
    <Screen padded={false} topInset={false}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
      <DetailHeroImage
        imageUri={event.imageURL}
        fallbackImageUri={event.villageCoverImage}
        fallbackIcon="calendar-outline"
      />
      <FloatingBackButton />
      <FloatingShareButton onPress={() => void share(getEventLink(event.id), event.title)} />
      {canOrganize && (
        <FloatingEditButton
          accessibilityLabel={t('event.editEvent')}
          onPress={() => router.push(`/event/${event.id}/organize` as never)}
        />
      )}
      <VStack gap={4} className="p-4">
        <Text variant="h1">{event.title}</Text>
        <Text>
          {event.endDate
            ? t('event.dateRange', {
                start: formatDate(event.startDate, 'long'),
                end: formatDate(event.endDate, 'long'),
              })
            : formatDate(event.startDate, 'long')}
        </Text>
        {event.location ? (
          <HStack gap={2} className="items-center">
            <Text tone="muted">{event.location.displayName}</Text>
            <Button variant="ghost" onPress={openInMaps}>
              {t('event.locationPin')}
            </Button>
          </HStack>
        ) : null}
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

        {!user && (
          <Button
            variant="primary"
            fullWidth
            onPress={() => gate.requireAuth(`/event/${event.id}`, t('guest.event'))}
          >
            {t('guest.eventCta')}
          </Button>
        )}
        {!person && user && (
          <Text tone="muted">{t('event.register.needsPerson')}</Text>
        )}
      </VStack>
      </ScrollView>
      {person && user && (
        <RegisterFab
          eventId={event.id}
          userId={user.uid}
          personId={person.id}
          name={personName}
          telephoneRequired={!!event.telephoneRequired}
        />
      )}
    </Screen>
  );
}
