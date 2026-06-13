import { useEffect, useState } from 'react';
import { FlatList, ActivityIndicator, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { Button } from '../../components/primitives/Button';
import { EventCard } from '../../components/feature/EventCard';
import { NewsCard } from '../../components/feature/NewsCard';
import { SegmentedToggle } from '../../components/feature/SegmentedToggle';
import { AppHeader } from '../../components/layout/AppHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { getUpcomingFeed } from '@cultuvilla/shared/services/feedService';
import { getHomeFeed } from '@cultuvilla/shared/services/newsService';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';
import type { NewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';

type FeedEvent = EventData & { id: string };
type FeedNews = NewsPostData & { id: string };
type FeedTab = 'eventos' | 'noticias';

export default function FeedScreen() {
  const { t } = useT();
  const { profile } = useAuth();
  const municipalityId = profile?.activeMunicipalityId ?? null;

  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [news, setNews] = useState<FeedNews[] | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsRefreshing, setNewsRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<FeedTab>('eventos');

  async function load() {
    try {
      setError(null);
      const result = await withFirestoreErrorLog('feed:getUpcomingFeed', () => getUpcomingFeed(50));
      setEvents(result.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
    }
  }

  async function loadNews() {
    if (!municipalityId) {
      setNews([]);
      return;
    }
    try {
      setNewsError(null);
      const result = await withFirestoreErrorLog('feed:getHomeFeed', () =>
        getHomeFeed(municipalityId, { limit: 50 }),
      );
      setNews(result);
    } catch (e) {
      setNewsError(e instanceof Error ? e.message : 'unknown');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Lazily load the news feed the first time the user opens the tab.
  useEffect(() => {
    if (activeTab === 'noticias' && news === null) void loadNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, municipalityId]);

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
        news === null && !newsError ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : newsError ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text tone="danger">{newsError}</Text>
          </View>
        ) : (
          <FlatList
            contentContainerClassName={
              (news ?? []).length === 0 ? 'flex-1 items-center justify-center px-8' : 'p-4 gap-4'
            }
            data={news ?? []}
            keyExtractor={(n) => n.id}
            ListEmptyComponent={
              <View className="items-center justify-center px-8">
                <Ionicons name="newspaper-outline" size={48} color="#64748b" />
                <Text tone="muted" className="mt-3 mb-4 text-center">
                  {t('feed.news.empty')}
                </Text>
                <Button onPress={() => router.push('/news/new')}>{t('feed.news.create')}</Button>
              </View>
            }
            renderItem={({ item }) => (
              <NewsCard post={item} onPress={(id) => router.push(`/news/${id}`)} />
            )}
            refreshControl={
              <RefreshControl
                refreshing={newsRefreshing}
                onRefresh={async () => {
                  setNewsRefreshing(true);
                  await loadNews();
                  setNewsRefreshing(false);
                }}
              />
            }
          />
        )
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
            (events ?? []).length === 0 ? 'flex-1 items-center justify-center px-8' : 'p-4 gap-4'
          }
          data={events ?? []}
          keyExtractor={(e) => e.id}
          ListEmptyComponent={
            <View className="items-center justify-center px-8">
              <Ionicons name="calendar-outline" size={48} color="#64748b" />
              <Text tone="muted" className="mt-3 mb-4 text-center">
                {t('feed.empty')}
              </Text>
              <Button onPress={() => router.push('/event/new')}>{t('feed.events.create')}</Button>
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
