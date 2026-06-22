import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ActivityIndicator, View } from 'react-native';
import { router, type Href } from 'expo-router';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { VStack, HStack, Text, Input, Escudo, Pressable } from '../primitives';
import { useT } from '../../lib/i18n';
import {
  getActiveCommunities,
  listMunicipalitiesPage,
} from '@cultuvilla/shared/services/municipalityService';
import { escudoThumbDisplayUrl } from '@cultuvilla/shared/models/municipality';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';

type Muni = MunicipalityData & { id: string };
const PAGE_SIZE = 20;
const ACCENT = '#bb5d3a';

// One FlatList renders two labelled sections: a fixed "Municipios activos" group
// (client-filtered) followed by the cursor-paginated "Todos" group. The groups
// intentionally overlap — "activos" is a shortcut, "Todos" is exhaustive.
type Row =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'muni'; key: string; muni: Muni };

export function VillageDiscovery() {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<Muni[] | null>(null);
  const [all, setAll] = useState<Muni[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Bumped on every new search so a slow in-flight page can't clobber a newer one.
  const reqId = useRef(0);

  useEffect(() => {
    void getActiveCommunities()
      .then(setActive)
      .catch((e) =>
        console.log('[VillageDiscovery] getActiveCommunities ERR', e?.code, e?.message),
      );
  }, []);

  // (Re)seed the "Todos" list whenever the search term changes (debounced).
  useEffect(() => {
    const myReq = ++reqId.current;
    const handle = setTimeout(() => {
      void (async () => {
        const page = await listMunicipalitiesPage({ search, limit: PAGE_SIZE });
        if (reqId.current !== myReq) return; // a newer search superseded this one
        setAll(page.items);
        setCursor(page.nextCursor);
        setExhausted(page.nextCursor === null);
      })();
    }, 200);
    return () => clearTimeout(handle);
  }, [search]);

  const loadMore = useCallback(async () => {
    if (loadingMore || exhausted || !cursor) return;
    setLoadingMore(true);
    const myReq = reqId.current;
    try {
      const page = await listMunicipalitiesPage({ search, cursor, limit: PAGE_SIZE });
      if (reqId.current !== myReq) return;
      setAll((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
      setExhausted(page.nextCursor === null);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, exhausted, cursor, search]);

  const activeFiltered = useMemo(() => {
    if (!active) return [];
    const q = search.trim().toLowerCase();
    return q ? active.filter((m) => m.name.toLowerCase().includes(q)) : active;
  }, [active, search]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (activeFiltered.length > 0) {
      out.push({ kind: 'header', key: 'h-active', label: t('discover.activeGroup') });
      activeFiltered.forEach((m) => out.push({ kind: 'muni', key: `active-${m.id}`, muni: m }));
    }
    out.push({ kind: 'header', key: 'h-all', label: t('discover.allGroup') });
    all.forEach((m) => out.push({ kind: 'muni', key: `all-${m.id}`, muni: m }));
    return out;
  }, [activeFiltered, all, t]);

  if (active === null) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const openMuni = (m: Muni) => {
    // Active villages → the rich village home (self-join lives there).
    // Dormant municipalities → the "start this village" flow.
    const target: Href = m.communityActive
      ? { pathname: '/village/[villageId]', params: { villageId: m.id } }
      : { pathname: '/discover/start/[municipalityId]', params: { municipalityId: m.id } };
    router.push(target);
  };

  return (
    <View className="flex-1">
      <View className="p-4">
        <Input
          label={t('discover.search')}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerClassName="px-4 pb-8 gap-3"
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<Text tone="muted">{t('discover.empty')}</Text>}
        ListFooterComponent={
          loadingMore ? (
            <View className="py-3">
              <ActivityIndicator />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <Text variant="h3" className="pt-2" style={{ color: ACCENT }}>
                {item.label}
              </Text>
            );
          }
          const m = item.muni;
          return (
            <Pressable
              onPress={() => openMuni(m)}
              className={`w-full rounded-md border bg-surface px-4 py-3 ${
                m.communityActive ? 'border-accent' : 'border-subtle'
              }`}
            >
              <HStack gap={3} className="items-center">
                <Escudo url={escudoThumbDisplayUrl(m)} size={40} fallbackInitial={m.name} />
                <VStack gap={1} className="flex-1">
                  <Text>{m.name}</Text>
                  <Text tone="muted" variant="bodySm">
                    {m.province}
                  </Text>
                </VStack>
                <Text
                  variant="bodySm"
                  tone={m.communityActive ? undefined : 'muted'}
                  style={m.communityActive ? { color: ACCENT } : undefined}
                >
                  {m.communityActive ? t('discover.activeBadge') : t('discover.inactive')}
                </Text>
              </HStack>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
