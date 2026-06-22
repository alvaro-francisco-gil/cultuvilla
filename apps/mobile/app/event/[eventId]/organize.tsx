import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, Redirect } from 'expo-router';
import { Screen } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { EventOrganizeConsole } from '../../../components/feature/EventOrganizeConsole';
import { useEventOrganizer } from '../../../lib/events/useEventOrganizer';
import { useT } from '../../../lib/i18n';
import { getEvent } from '@cultuvilla/shared/services/eventService';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';

type Ev = EventData & { id: string };

// Organizer-only event management console. Non-organizers are redirected back
// to the public event detail.
export default function EventOrganizeScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { t } = useT();
  const [event, setEvent] = useState<Ev | null | undefined>(undefined);

  useEffect(() => {
    if (!eventId) return;
    void getEvent(eventId).then((e) => setEvent(e));
  }, [eventId]);

  const { canOrganize, loading } = useEventOrganizer(event ?? null);

  if (!eventId) return null;
  if (event === undefined || loading) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('event.editEvent')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }
  if (event === null) return <Redirect href={`/event/${eventId}`} />;
  if (!canOrganize) return <Redirect href={`/event/${eventId}`} />;

  return (
    <Screen padded={false} scroll>
      <ScreenHeader title={t('event.editEvent')} />
      <EventOrganizeConsole event={event} />
    </Screen>
  );
}
