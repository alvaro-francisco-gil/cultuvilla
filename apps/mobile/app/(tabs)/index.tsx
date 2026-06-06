import { useEffect, useState } from 'react';
import { FlatList, ActivityIndicator, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { EventCard } from '../../components/feature/EventCard';
import { SegmentedToggle } from '../../components/feature/SegmentedToggle';
import { AppHeader } from '../../components/layout/AppHeader';
import { useT } from '../../lib/i18n';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { getUpcomingFeed } from '@cultuvilla/shared/services/feedService';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';

type FeedEvent = EventData & { id: string };
type FeedTab = 'eventos' | 'noticias';

export default function FeedScreen() {
  const { t } = useT();
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FeedTab>('eventos');

  async function load() {
    try {
      setError(null);
      const result = await withFirestoreErrorLog(
        'feed:getUpcomingFeed',
        () => getUpcomingFeed(50),
      );
      setEvents(result.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const toggle = (
    <View className="px-4 pt-3 pb-2 bg-surface">
      <SegmentedToggle<FeedTab>
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'eventos', label: t('feed.tab.events') },
          { value: 'noticias', label: t('feed.tab.news') },
        ]}
      />
    </View>
  );

  return (
    <Screen padded={false} topInset={false}>
      <AppHeader />
      {toggle}
      {activeTab === 'noticias' ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="newspaper-outline" size={48} color="#64748b" />
          <Text tone="muted" className="mt-3 text-center">
            {t('feed.news.comingSoonBody')}
          </Text>
        </View>
      ) : events === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text tone="danger">{error}</Text>
        </View>
      ) : (
        <FlatList
          contentContainerClassName={
            (events ?? []).length === 0
              ? 'flex-1 items-center justify-center px-8'
              : 'p-4 gap-4'
          }
          data={events ?? []}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={
            <View className="items-center justify-center px-8">
              <Ionicons name="calendar-outline" size={48} color="#64748b" />
              <Text tone="muted" className="mt-3 text-center">
                {t('feed.empty')}
              </Text>
            </View>
          }
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
      )}
    </Screen>
  );
}
