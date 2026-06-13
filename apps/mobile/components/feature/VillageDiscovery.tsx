import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ActivityIndicator, Platform, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { VStack, HStack, Text, Input, Button, Escudo, Pressable } from '../primitives';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import {
  getActiveCommunities,
  searchMunicipalities,
} from '@cultuvilla/shared/services/municipalityService';
import { getMyJoinRequests } from '@cultuvilla/shared/services/joinRequestService';
import { escudoThumbDisplayUrl } from '@cultuvilla/shared/models/municipality';
import type { MunicipalityData } from '@cultuvilla/shared/models/municipality';

type Muni = MunicipalityData & { id: string };

const PAGE_SIZE = 50;

export function VillageDiscovery() {
  const { user } = useAuth();
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<Muni[] | null>(null);
  const [allResults, setAllResults] = useState<Muni[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void getActiveCommunities()
      .then((rs) => setActive(rs))
      .catch((e) => console.log('[VillageDiscovery] getActiveCommunities ERR', e?.code, e?.message));
    if (user) {
      void getMyJoinRequests(user.uid)
        .then((rs) => {
          setPendingIds(
            new Set(rs.filter((r) => r.status === 'pending').map((r) => r.municipalityId)),
          );
        })
        .catch((e) => console.log('[VillageDiscovery] getMyJoinRequests ERR', e?.code, e?.message));
    }
  }, [user]);

  // Paged server-side search when user opens the "show all" view.
  useEffect(() => {
    if (!showAll) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const list = await searchMunicipalities(search, PAGE_SIZE);
      if (!cancelled) setAllResults(list);
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [showAll, search]);

  // When NOT in showAll mode, client-side filter the small active list.
  const data = useMemo(() => {
    if (showAll) return allResults;
    if (!active) return [];
    if (!search.trim()) return active;
    const q = search.toLowerCase();
    return active.filter((m) => m.name.toLowerCase().includes(q));
  }, [showAll, allResults, active, search]);

  if (!showAll && active === null) {
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
          const joinTarget: Href = {
            pathname: '/discover/request-join/[municipalityId]',
            params: { municipalityId: item.id },
          };
          const organizerTarget: Href = {
            pathname: '/discover/request-organizer/[municipalityId]',
            params: { municipalityId: item.id },
          };
          const onPress = () => {
            if (isActive) {
              router.push(joinTarget);
              return;
            }
            const title = t('discover.noOrganizerTitle');
            const body = t('discover.noOrganizerBody', { name: item.name });
            // react-native-web 0.21 ships Alert.alert as a no-op, so we fall
            // back to window.confirm on web (title + body in one prompt).
            if (Platform.OS === 'web') {
              if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${body}`)) {
                router.push(organizerTarget);
              }
              return;
            }
            Alert.alert(title, body, [
              { text: t('discover.cancel'), style: 'cancel' },
              {
                text: t('discover.noOrganizerConfirm'),
                onPress: () => router.push(organizerTarget),
              },
            ]);
          };
          return (
            <Pressable
              onPress={onPress}
              disabled={isPending}
              className={`w-full rounded-md border border-accent bg-surface px-4 py-3 ${isPending ? 'opacity-50' : ''}`}
            >
              <HStack gap={3} className="items-center">
                <Escudo url={escudoThumbDisplayUrl(item)} size={40} fallbackInitial={item.name} />
                <VStack gap={1}>
                  <Text>{item.name}</Text>
                  <Text tone="muted" variant="bodySm">
                    {item.province}
                  </Text>
                  {isPending && (
                    <Text tone="muted" variant="bodySm">
                      {t('requests.status.pending')}
                    </Text>
                  )}
                </VStack>
              </HStack>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
