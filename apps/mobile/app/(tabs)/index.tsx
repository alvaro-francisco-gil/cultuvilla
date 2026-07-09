import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { Pressable } from '../../components/primitives/Pressable';
import { Fab } from '../../components/primitives/Fab';
import { EventCard } from '../../components/feature/EventCard';
import { NewsCard } from '../../components/feature/NewsCard';
import { SegmentedToggle } from '../../components/feature/SegmentedToggle';
import { FilterPill, FILTER_PILL_HEIGHT } from '../../components/feature/FilterPill';
import { FilterSheet, type FilterSheetOption } from '../../components/feature/FilterSheet';
import { AppHeader } from '../../components/layout/AppHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useRegisterGate } from '../../lib/auth/RegisterGateContext';
import { useT } from '../../lib/i18n';
import { withFirestoreErrorLog } from '../../lib/firestoreErrorLog';
import { webSpread } from '../../lib/platform';
import { useWebScrollTopRefresh } from '../../lib/useWebScrollTopRefresh';
import { getUpcomingFeed, haversineKm } from '@cultuvilla/shared/services/feedService';
import { getAllVillagesFeed } from '@cultuvilla/shared/services/newsService';
import { getActiveCommunities } from '@cultuvilla/shared/services/municipalityService';
import type { EventData } from '@cultuvilla/shared/models/event/EventDataModel';
import {
  NEWS_POST_CATEGORIES,
  type NewsPostData,
} from '@cultuvilla/shared/models/news/NewsPostDataModel';
import type { LatLng } from '@cultuvilla/shared/models/core/LocationDataModel';

const ACCENT = '#bb5d3a'; // colors.ts: light.bg.accent (terracotta)
// Breathing room between the filter bar and the first card. Lives in the feed's
// top padding (the content behind), not in the filter component itself.
const FEED_TOP_GAP = 12;

type FeedEvent = EventData & { id: string };
type FeedNews = NewsPostData & { id: string };
type FeedTab = 'eventos' | 'noticias';
type DatePreset = 'hoy' | 'semana' | 'mes';
type ActiveSheet = 'village' | 'date' | 'category' | 'sort' | null;
type Village = {
  id: string;
  name: string;
  coordinates: LatLng | null;
};

/** True when `d` falls inside the upcoming window named by `preset`. */
function inDatePreset(d: Date, preset: DatePreset): boolean {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + (preset === 'hoy' ? 1 : preset === 'semana' ? 7 : 30));
  return d >= start && d < end;
}

const TABS: FeedTab[] = ['eventos', 'noticias'];

export default function FeedScreen() {
  const { t } = useT();
  const { profile } = useAuth();
  const gate = useRegisterGate();
  const activeMunicipalityId = profile?.activeMunicipalityId ?? null;

  // Guests can browse the feed, but creating an event/article requires auth.
  // requireAuth returns true only when signed in; otherwise it opens the
  // RegisterSheet and we skip navigation.
  const createEvent = useCallback(() => {
    if (gate.requireAuth('/event/new', t('guest.createEvent'))) router.push('/event/new');
  }, [gate, t]);
  const createNews = useCallback(() => {
    if (gate.requireAuth('/news/new', t('guest.createNews'))) router.push('/news/new');
  }, [gate, t]);
  const { width } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const eventsListRef = useRef<FlatList<FeedEvent>>(null);
  const newsListRef = useRef<FlatList<FeedNews>>(null);

  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [news, setNews] = useState<FeedNews[] | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsRefreshing, setNewsRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState<FeedTab>('eventos');

  const [villages, setVillages] = useState<Village[]>([]);

  // Filter state. null/'' = unset (the "all" default). Village + search apply to
  // both feeds; date + sort affect events, category affects news.
  const [villageFilter, setVillageFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DatePreset | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sortByProximity, setSortByProximity] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  // Fade-on-scroll for the floating filter bar: 0 = shown, 1 = hidden.
  const filterAnim = useRef(new Animated.Value(0)).current;
  const filterHiddenRef = useRef(false);
  const lastScrollY = useRef(0);
  // Measured height of the floating overlay (toggle + filter bar). Seeded with
  // a rough estimate; corrected on first onLayout.
  const [overlayHeight, setOverlayHeight] = useState(FILTER_PILL_HEIGHT + 12 + 56);
  // Mirrors the hidden state so the faded-out (but still positioned) pills stop
  // intercepting taps meant for the feed behind them.
  const [filterInteractive, setFilterInteractive] = useState(true);

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
    try {
      setNewsError(null);
      const result = await withFirestoreErrorLog('feed:getAllVillagesFeed', () =>
        getAllVillagesFeed({ limit: 50 }),
      );
      setNews(result);
    } catch (e) {
      setNewsError(e instanceof Error ? e.message : 'unknown');
    }
  }

  // Village list for the filter pills — static enough to fetch once on mount.
  useEffect(() => {
    void getActiveCommunities()
      .then((communities) =>
        setVillages(
          communities.map((c) => ({
            id: c.id,
            name: c.name,
            coordinates: c.coordinates,
          })),
        ),
      )
      .catch(() => setVillages([]));
  }, []);

  // Refetch the events feed whenever Explore regains focus (covers first mount
  // too), so an event just created on another screen shows up on return without
  // a manual refresh. Mirrors useVillageHome / the detail screens.
  useFocusEffect(
    useCallback(() => {
      void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Lazily load the news feed the first time the user opens the tab.
  useEffect(() => {
    if (activeTab === 'noticias' && news === null) void loadNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Web-only fallback for RefreshControl, which is inert on react-native-web:
  // scrolling up at the top of either feed refetches it.
  useWebScrollTopRefresh(
    eventsListRef,
    async () => {
      setRefreshing(true);
      await load();
      setRefreshing(false);
    },
    events !== null && !error,
  );
  useWebScrollTopRefresh(
    newsListRef,
    async () => {
      setNewsRefreshing(true);
      await loadNews();
      setNewsRefreshing(false);
    },
    news !== null && !newsError,
  );

  // Reference point for proximity sort: the user's active village coordinates.
  const referenceCoords = useMemo<LatLng | null>(
    () => villages.find((v) => v.id === activeMunicipalityId)?.coordinates ?? null,
    [villages, activeMunicipalityId],
  );

  const query = search.trim().toLowerCase();

  const visibleEvents = useMemo(() => {
    let list = events ?? [];
    // TEMP: pueblo filter disabled — re-enable to scope events by village.
    // if (villageFilter) list = list.filter((e) => e.municipalityId === villageFilter);
    if (dateFilter) list = list.filter((e) => inDatePreset(e.startDate, dateFilter));
    if (query) {
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(query) || e.description.toLowerCase().includes(query),
      );
    }
    if (sortByProximity && referenceCoords) {
      const dist = (e: FeedEvent) =>
        e.villageCoordinates
          ? haversineKm(referenceCoords, e.villageCoordinates)
          : Number.POSITIVE_INFINITY;
      list = [...list].sort((a, b) => dist(a) - dist(b));
    }
    return list;
  }, [events, villageFilter, dateFilter, query, sortByProximity, referenceCoords]);

  const visibleNews = useMemo(() => {
    let list = news ?? [];
    // TEMP: pueblo filter disabled — re-enable to scope news by village.
    // if (villageFilter) list = list.filter((n) => n.municipalityId === villageFilter);
    if (categoryFilter) list = list.filter((n) => n.category === categoryFilter);
    if (query) {
      list = list.filter(
        (n) => n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query),
      );
    }
    return list;
  }, [news, villageFilter, categoryFilter, query]);

  // ── filter sheet option lists ──
  const villageOptions: FilterSheetOption[] = villages.map((v) => ({ value: v.id, label: v.name }));
  const dateOptions: FilterSheetOption[] = [
    { value: 'hoy', label: t('feed.filter.dateToday') },
    { value: 'semana', label: t('feed.filter.dateWeek') },
    { value: 'mes', label: t('feed.filter.dateMonth') },
  ];
  const categoryOptions: FilterSheetOption[] = NEWS_POST_CATEGORIES.map((c) => ({
    value: c,
    label: t(`news.compose.category.${c}`),
  }));

  const selectedVillageName = villages.find((v) => v.id === villageFilter)?.name ?? null;
  const dateLabel = dateFilter ? t(`feed.filter.date${dateFilter === 'hoy' ? 'Today' : dateFilter === 'semana' ? 'Week' : 'Month'}`) : null;
  const categoryLabel = categoryFilter ? t(`news.compose.category.${categoryFilter}`) : null;

  function goToTab(tab: FeedTab) {
    setActiveTab(tab);
    pagerRef.current?.scrollTo({ x: TABS.indexOf(tab) * width, animated: true });
  }

  // Keep the toggle/filter pills in sync while the user swipes the pager.
  function onPagerScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width === 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / width);
    const tab = TABS[page] ?? 'eventos';
    setActiveTab((prev) => (prev === tab ? prev : tab));
  }

  const setFilterHidden = useCallback(
    (hide: boolean) => {
      if (filterHiddenRef.current === hide) return;
      filterHiddenRef.current = hide;
      setFilterInteractive(!hide);
      // Opacity-only fade, in place (no movement). useNativeDriver:true is safe
      // for opacity on the web build (unlike interpolated transforms).
      Animated.timing(filterAnim, {
        toValue: hide ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    },
    [filterAnim],
  );

  // Vertical feed scroll → hide the filter bar going down, reveal it going up.
  const onFeedScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const dy = y - lastScrollY.current;
      lastScrollY.current = y;
      if (y <= 0) setFilterHidden(false);
      else if (dy > 6) setFilterHidden(true);
      else if (dy < -6) setFilterHidden(false);
    },
    [setFilterHidden],
  );

  // Both the toggle and the filter bar float above the feed now, so the feed
  // must clear the full overlay height (toggle + filter bar) regardless of
  // whether villages — hence filter pills — are present.
  const feedPaddingTop = overlayHeight + FEED_TOP_GAP;
  const filterOpacity = filterAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  // Transparent container so the feed flows behind the opaque toggle pill; the
  // pt-3 gap is where content peeks through "between the header and the toggle".
  const toggle = (
    <View className="px-4 pt-3 pb-2">
      <SegmentedToggle<FeedTab>
        value={activeTab}
        onChange={goToTab}
        options={[
          { value: 'eventos', label: t('feed.tab.events') },
          { value: 'noticias', label: t('feed.tab.news') },
        ]}
      />
    </View>
  );

  const filterBar = villages.length > 0 && (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Transparent so the feed flows behind the opaque pills; no padding below
      // the buttons. flexGrow:0 keeps the row hugging its content height
      // (RN-Web gives a horizontal ScrollView flexGrow:1 by default).
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16 }}
    >
      {/* TEMP: pueblo filter hidden — re-enable to scope the feed by village.
      <FilterPill
        label={selectedVillageName ?? t('feed.filter.village')}
        active={villageFilter !== null}
        onPress={() => setActiveSheet('village')}
        testID="filter-village"
      />
      */}

      {/* Buscar — inline expandable search. */}
      {searchOpen ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            borderRadius: 24,
            borderWidth: 1.5,
            borderColor: ACCENT,
            height: FILTER_PILL_HEIGHT,
            paddingHorizontal: 12,
            marginRight: 8,
            width: 220,
          }}
        >
          <Ionicons name="search" size={15} color={ACCENT} />
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder={t('feed.filter.searchPlaceholder')}
            placeholderTextColor="#a6a897"
            // Fixed-height container + zero-padding input keeps the oval the same
            // height as the other pills; text scrolls inside the fixed width.
            style={{
              flex: 1,
              minWidth: 0,
              marginLeft: 6,
              marginRight: 6,
              paddingVertical: 0,
              height: '100%',
              textAlignVertical: 'center',
              includeFontPadding: false,
              color: '#566047',
            }}
          />
          <Pressable
            onPress={() => {
              setSearch('');
              setSearchOpen(false);
            }}
            accessibilityLabel={t('feed.filter.search')}
          >
            <Ionicons name="close-circle" size={16} color={ACCENT} />
          </Pressable>
        </View>
      ) : (
        <FilterPill
          label={search.trim() || t('feed.filter.search')}
          icon="search-outline"
          active={search.trim().length > 0}
          hideChevron
          onPress={() => setSearchOpen(true)}
          testID="filter-search"
        />
      )}

      {activeTab === 'eventos' ? (
        <>
          <FilterPill
            label={dateLabel ?? t('feed.filter.date')}
            active={dateFilter !== null}
            onPress={() => setActiveSheet('date')}
            testID="filter-date"
          />
          {referenceCoords ? (
            <FilterPill
              label={sortByProximity ? t('feed.filter.sortProximity') : t('feed.filter.sort')}
              active={sortByProximity}
              onPress={() => setActiveSheet('sort')}
              testID="filter-sort"
            />
          ) : null}
        </>
      ) : (
        <FilterPill
          label={categoryLabel ?? t('feed.filter.category')}
          active={categoryFilter !== null}
          onPress={() => setActiveSheet('category')}
          testID="filter-category"
        />
      )}
    </ScrollView>
  );

  const eventsPage =
    events === null && !error ? (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    ) : error ? (
      <View className="flex-1 items-center justify-center px-8">
        <Text tone="danger">{error}</Text>
      </View>
    ) : (
      <FlatList
        ref={eventsListRef}
        style={{ flex: 1 }}
        onScroll={onFeedScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: feedPaddingTop }}
        contentContainerClassName={
          visibleEvents.length === 0 ? 'flex-1 items-center justify-center px-8' : 'px-4 pb-4 gap-4'
        }
        data={visibleEvents}
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
              locationName: item.location?.displayName ?? null,
              imageURL: item.imageURL,
              villageCoverImage: item.villageCoverImage ?? null,
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
    );

  const newsPage =
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
        ref={newsListRef}
        style={{ flex: 1 }}
        onScroll={onFeedScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: feedPaddingTop }}
        contentContainerClassName={
          visibleNews.length === 0 ? 'flex-1 items-center justify-center px-8' : 'px-4 pb-4 gap-4'
        }
        data={visibleNews}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={
          <View className="items-center justify-center px-8">
            <Ionicons name="newspaper-outline" size={48} color="#64748b" />
            <Text tone="muted" className="mt-3 text-center">
              {t('feed.news.empty')}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <NewsCard
            post={item}
            fallbackImageUri={null}
            onPress={(id) => router.push(`/news/${id}`)}
          />
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
    );

  return (
    <Screen padded={false} topInset={false} bottomInset={false}>
      <AppHeader centerLabel={t('header.brand')} />
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={onPagerScroll}
          style={{ flex: 1 }}
          // Web-only: RN-Web doesn't stretch a horizontal ScrollView's children
          // to its cross-axis height the way native does, so the page wrappers
          // (and the FlatList's flex:1 inside) have no bounded height and the
          // list grows to content height instead of becoming an internal
          // scroller — vertical scroll silently dies. Bounding the content
          // container to one viewport height gives the `height: '100%'` chain
          // below something to resolve against. No-op on native.
          contentContainerStyle={webSpread({ height: '100%' as const })}
        >
          <View style={{ width, ...webSpread({ height: '100%' as const }) }}>{eventsPage}</View>
          <View style={{ width, ...webSpread({ height: '100%' as const }) }}>{newsPage}</View>
        </ScrollView>

        {/* Floating overlay — the toggle and filter bar both sit above the feed
            (which flows behind them) and fade out in place on scroll-down, back
            in on scroll-up, together. box-none lets taps fall through the
            transparent areas to the feed. */}
        <Animated.View
          onLayout={(e) => setOverlayHeight(e.nativeEvent.layout.height)}
          pointerEvents={filterInteractive ? 'box-none' : 'none'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            opacity: filterOpacity,
          }}
        >
          {toggle}
          {filterBar}
        </Animated.View>

        {/* Web-only refresh feedback: RN-Web renders RefreshControl inert, so the
            pull-down-to-refresh gesture (useWebScrollTopRefresh) has no spinner.
            This pill gives it one. Native shows the RefreshControl spinner. */}
        {Platform.OS === 'web' && (activeTab === 'noticias' ? newsRefreshing : refreshing) ? (
          <View
            pointerEvents="none"
            style={{ position: 'absolute', top: 8, left: 0, right: 0, zIndex: 20, alignItems: 'center' }}
          >
            <View className="flex-row items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
              <ActivityIndicator size="small" color={ACCENT} />
              <Text tone="muted" className="text-sm">
                {t('feed.refreshing')}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* TEMP: pueblo filter hidden — re-enable alongside the village FilterPill above.
      <FilterSheet
        visible={activeSheet === 'village'}
        title={t('feed.filter.villageTitle')}
        options={villageOptions}
        selectedValue={villageFilter}
        onSelect={setVillageFilter}
        onClose={() => setActiveSheet(null)}
        allLabel={t('feed.filter.villageAll')}
        searchable
        searchPlaceholder={t('feed.filter.searchPlaceholder')}
      />
      */}
      <FilterSheet
        visible={activeSheet === 'date'}
        title={t('feed.filter.dateTitle')}
        options={dateOptions}
        selectedValue={dateFilter}
        onSelect={(v) => setDateFilter(v as DatePreset | null)}
        onClose={() => setActiveSheet(null)}
        allLabel={t('feed.filter.dateAll')}
      />
      <FilterSheet
        visible={activeSheet === 'category'}
        title={t('feed.filter.categoryTitle')}
        options={categoryOptions}
        selectedValue={categoryFilter}
        onSelect={setCategoryFilter}
        onClose={() => setActiveSheet(null)}
        allLabel={t('feed.filter.categoryAll')}
      />
      <FilterSheet
        visible={activeSheet === 'sort'}
        title={t('feed.filter.sortTitle')}
        options={[{ value: 'proximity', label: t('feed.filter.sortProximity') }]}
        selectedValue={sortByProximity ? 'proximity' : null}
        onSelect={(v) => setSortByProximity(v === 'proximity')}
        onClose={() => setActiveSheet(null)}
        allLabel={t('feed.filter.sortDate')}
      />

      <Fab
        testID="create-fab"
        label={activeTab === 'noticias' ? t('feed.news.create') : t('feed.events.create')}
        opacity={filterOpacity}
        interactive={filterInteractive}
        onPress={() => (activeTab === 'noticias' ? createNews() : createEvent())}
      />
    </Screen>
  );
}
