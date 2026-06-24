import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ActivityIndicator, View, TextInput } from 'react-native';
import { router, type Href } from 'expo-router';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { VStack, HStack, Text, Escudo, Pressable } from '../primitives';
import { JoinVillageModal } from './JoinVillageModal';
import { useT } from '../../lib/i18n';
import {
  getActiveCommunities,
  listMunicipalitiesPage,
} from '@cultuvilla/shared/services/municipalityService';
import { escudoThumbDisplayUrl } from '@cultuvilla/shared/models/municipality';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getUserMemberships,
  addVillageMember,
} from '@cultuvilla/shared/services/villageMemberService';

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

  const { user } = useAuth();
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [pendingJoin, setPendingJoin] = useState<Muni | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!user) {
      setJoinedIds(new Set());
      return;
    }
    let cancelled = false;
    void getUserMemberships(user.uid)
      .then((ms) => {
        if (!cancelled) setJoinedIds(new Set(ms.map((m) => m.municipalityId)));
      })
      .catch((e) =>
        console.log('[VillageDiscovery] getUserMemberships ERR', e?.code, e?.message),
      );
    return () => {
      cancelled = true;
    };
  }, [user]);

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

  const viewMuni = (m: Muni) => {
    // Active villages → the rich village home; dormant municipalities → the "start" flow.
    const target: Href = m.communityActive
      ? { pathname: '/village/[villageId]', params: { villageId: m.id } }
      : { pathname: '/discover/start/[municipalityId]', params: { municipalityId: m.id } };
    router.push(target);
  };

  const onPressJoin = (m: Muni) => {
    if (!user) {
      router.push('/(auth)/login' as Href);
      return;
    }
    setPendingJoin(m);
  };

  const confirmJoin = async (barrioId: string | null) => {
    if (!user || !pendingJoin) return;
    const id = pendingJoin.id;
    setJoining(true);
    try {
      await addVillageMember(id, user.uid, 'user', barrioId);
      setJoinedIds((prev) => new Set(prev).add(id));
      setPendingJoin(null);
      router.push({ pathname: '/village/[villageId]', params: { villageId: id } });
    } finally {
      setJoining(false);
    }
  };

  return (
    <View className="flex-1">
      <View className="px-4 py-2">
        <TextInput
          placeholder={t('discover.search')}
          accessibilityLabel={t('discover.search')}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          className="border border-subtle rounded-md px-3 py-1 bg-surface text-primary text-body"
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerClassName="px-4 pt-3 pb-8 gap-3"
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
          const joined = joinedIds.has(m.id);
          return (
            <Pressable
              onPress={() => viewMuni(m)}
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
                {m.communityActive ? (
                  <HStack gap={1} className="items-center">
                    <Pressable
                      onPress={() => viewMuni(m)}
                      accessibilityLabel={t('discover.viewVillage')}
                      hitSlop={8}
                      className="p-2"
                    >
                      <Ionicons name="eye-outline" size={22} color={ACCENT} />
                    </Pressable>
                    {joined ? (
                      <View accessibilityLabel={t('discover.alreadyMember')} className="p-2">
                        <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => onPressJoin(m)}
                        accessibilityLabel={t('discover.joinVillage')}
                        hitSlop={8}
                        className="p-2"
                      >
                        <Ionicons name="person-add-outline" size={22} color={ACCENT} />
                      </Pressable>
                    )}
                  </HStack>
                ) : null}
              </HStack>
            </Pressable>
          );
        }}
      />
      <JoinVillageModal
        municipality={
          pendingJoin
            ? { id: pendingJoin.id, name: pendingJoin.name, escudoUrl: escudoThumbDisplayUrl(pendingJoin) }
            : null
        }
        busy={joining}
        onCancel={() => setPendingJoin(null)}
        onConfirm={(barrioId) => void confirmJoin(barrioId)}
      />
    </View>
  );
}
