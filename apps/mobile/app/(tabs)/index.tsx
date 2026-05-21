import { useEffect, useState } from 'react';
import { FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { EventCard } from '../../components/feature/EventCard';
import { useT } from '../../lib/i18n';
import { getUpcomingFeed } from '@cultuvilla/shared/services/feedService';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';

type FeedEvent = EventData & { id: string };

export default function FeedScreen() {
  const { t } = useT();
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const result = await getUpcomingFeed(50);
      setEvents(result.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (events === null && !error) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <Text tone="danger">{error}</Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        contentContainerClassName="p-4 gap-4"
        data={events ?? []}
        keyExtractor={(e) => e.id}
        ListEmptyComponent={<Text tone="muted">{t('feed.empty')}</Text>}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      />
    </Screen>
  );
}
