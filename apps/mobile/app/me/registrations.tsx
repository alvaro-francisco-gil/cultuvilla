import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { EventCard } from '../../components/feature/EventCard';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { getUserRegistrationsAcrossEvents } from '@cultuvilla/shared/services/registrationService';
import { getEvent } from '@cultuvilla/shared/services/eventService';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';

type Row = EventData & { id: string };

export default function MyRegistrationsScreen() {
  const { user } = useAuth();
  const { t } = useT();
  const [events, setEvents] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      try {
        setError(null);
        const regs = await getUserRegistrationsAcrossEvents(user!.uid);
        const eventIds = Array.from(
          new Set(
            regs
              .map((r) => r.eventPath.split('/')[1])
              .filter((id): id is string => typeof id === 'string'),
          ),
        );
        const fetched = await Promise.all(eventIds.map((id) => getEvent(id)));
        if (cancelled) return;
        setEvents(fetched.filter((e): e is Row => e !== null));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'unknown');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('me.registrations.title')} />
      {events === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="p-4">
          <Text tone="danger">{error}</Text>
        </View>
      ) : (
        <FlatList
          contentContainerClassName="p-4 gap-4"
          data={events ?? []}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={<Text tone="muted">{t('me.registrations.empty')}</Text>}
          renderItem={({ item }) => (
            <EventCard
              event={{
                id: item.id,
                title: item.title,
                startDate: item.startDate,
                organizationName: item.organizationName,
              }}
              onPress={(id) => router.push(`/event/${id}`)}
            />
          )}
        />
      )}
    </Screen>
  );
}
