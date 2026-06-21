import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../../components/primitives/Screen';
import { VStack } from '../../components/primitives/VStack';
import { Text } from '../../components/primitives/Text';
import { RegisterButton } from '../../components/feature/RegisterButton';
import { DetailHeroImage } from '../../components/feature/DetailHeroImage';
import { FloatingBackButton } from '../../components/feature/FloatingBackButton';
import { FloatingShareButton } from '../../components/feature/FloatingShareButton';
import { useAuth } from '../../lib/auth/useAuth';
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
  const { t } = useT();
  const share = useShareDeepLink();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [person, setPerson] = useState<PersonDoc | null>(null);
  const [registered, setRegistered] = useState(false);

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
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
        <FloatingBackButton />
      </Screen>
    );
  }

  const personName = person ? buildDisplayName(person) : '';

  return (
    <Screen padded={false} topInset={false}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ScrollView>
      <DetailHeroImage
        imageUri={event.imageURL}
        fallbackImageUri={event.municipalityCoverImage}
        fallbackIcon="calendar-outline"
      />
      <FloatingBackButton />
      <FloatingShareButton onPress={() => void share(getEventLink(event.id))} />
      <VStack gap={4} className="p-4">
        <Text variant="h1">{event.title}</Text>
        <Text tone="muted">{event.organizationName}</Text>
        <Text>{formatDate(event.startDate, 'long')}</Text>
        {event.description ? <Text>{event.description}</Text> : null}

        {person && !registered && (
          <RegisterButton
            eventId={event.id}
            personId={person.id}
            name={personName}
            onRegistered={() => setRegistered(true)}
          />
        )}
        {registered && (
          <Text tone="success">{t('event.register.done')}</Text>
        )}
        {!person && user && (
          <Text tone="muted">{t('event.register.needsPerson')}</Text>
        )}
      </VStack>
      </ScrollView>
    </Screen>
  );
}
