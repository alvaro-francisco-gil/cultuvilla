import { useEffect, useMemo, useState } from 'react';
import { FlatList, ActivityIndicator, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { VStack, Text, Input, Button } from '../primitives';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getActiveCommunities,
  getMunicipalities,
} from '@cultuvilla/shared/services/municipalityService';
import { getMyJoinRequests } from '@cultuvilla/shared/services/joinRequestService';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';

type Muni = MunicipalityData & { id: string };

export function VillageDiscovery() {
  const { user } = useAuth();
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<Muni[] | null>(null);
  const [all, setAll] = useState<Muni[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getActiveCommunities()
      .then((rs) => {
        console.log('[VillageDiscovery] getActiveCommunities ok', rs.length);
        setActive(rs);
      })
      .catch((e) => console.log('[VillageDiscovery] getActiveCommunities ERR', e?.code, e?.message));
    if (user) {
      void getMyJoinRequests(user.uid)
        .then((rs) => {
          console.log('[VillageDiscovery] getMyJoinRequests ok', rs.length);
          setPendingIds(
            new Set(rs.filter((r) => r.status === 'pending').map((r) => r.municipalityId)),
          );
        })
        .catch((e) => console.log('[VillageDiscovery] getMyJoinRequests ERR', e?.code, e?.message));
    }
  }, [user]);

  useEffect(() => {
    if (showAll && !all) void getMunicipalities().then(setAll);
  }, [showAll, all]);

  const source = showAll ? all : active;

  const data = useMemo(() => {
    if (!source) return [];
    if (!search.trim()) return source;
    const q = search.toLowerCase();
    return source.filter((m) => m.name.toLowerCase().includes(q));
  }, [source, search]);

  if (source === null) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

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
        data={data}
        keyExtractor={(m) => m.id}
        contentContainerClassName="px-4 pb-8 gap-3"
        ListEmptyComponent={<Text tone="muted">{t('discover.empty')}</Text>}
        ListFooterComponent={
          !showAll ? (
            <View className="pt-2">
              <Button variant="ghost" onPress={() => setShowAll(true)}>
                <Text>{t('discover.notSeeing')}</Text>
              </Button>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isActive = item.communityActive;
          const isPending = pendingIds.has(item.id);
          const target: Href = isActive
            ? { pathname: '/discover/request-join/[municipalityId]', params: { municipalityId: item.id } }
            : { pathname: '/discover/request-organizer/[municipalityId]', params: { municipalityId: item.id } };
          const sub = isPending
            ? t('requests.status.pending')
            : isActive
              ? t('discover.requestJoin')
              : t('discover.requestOrganizer');
          return (
            <Button
              variant="secondary"
              onPress={() => router.push(target)}
              disabled={isPending}
              fullWidth
            >
              <VStack gap={1}>
                <Text>{item.name}</Text>
                <Text tone="muted" variant="bodySm">
                  {sub}
                </Text>
              </VStack>
            </Button>
          );
        }}
      />
    </View>
  );
}
