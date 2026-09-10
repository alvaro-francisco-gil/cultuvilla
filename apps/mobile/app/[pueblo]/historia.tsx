import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/primitives/Screen';
import { Text } from '../../../components/primitives/Text';
import { HStack } from '../../../components/primitives/HStack';
import { VStack } from '../../../components/primitives/VStack';
import { Pressable } from '../../../components/primitives/Pressable';
import { RemoteImage } from '../../../components/primitives/RemoteImage';
import { Fab } from '../../../components/primitives/Fab';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { buildTimelineRows } from '../../../lib/history/timeline';
import {
  getHistoryEntries,
  type HistoryEntryWithId,
} from '@cultuvilla/shared/services/historyService';
import { formatHistoryEntryDate, historicalCenturyLabel } from '@cultuvilla/shared/utils';

const RAIL_WIDTH = 28;
const DOT = 12;
const THUMB = 64;

function Rail({ dot }: { dot: boolean }) {
  return (
    <View style={{ width: RAIL_WIDTH, alignSelf: 'stretch', alignItems: 'center' }}>
      <View className="bg-subtle" style={{ position: 'absolute', top: 0, bottom: 0, width: 2 }} />
      {dot ? (
        <View
          className="bg-accent rounded-full"
          style={{ width: DOT, height: DOT, marginTop: 18 }}
        />
      ) : null}
    </View>
  );
}

/**
 * The pueblo's history as a vertical timeline: the present at the top, and
 * scrolling down goes further into the past. Entries are evenly spaced with a
 * divider opening each century (see `buildTimelineRows`).
 */
export default function VillageHistoryScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const { isMember } = useEntityCapabilities(villageId);
  const [entries, setEntries] = useState<HistoryEntryWithId[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!villageId) return;
    try {
      setEntries(await getHistoryEntries(villageId));
    } finally {
      setLoading(false);
    }
  }, [villageId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const rows = useMemo(() => buildTimelineRows(entries), [entries]);

  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('village.history.title')} />
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 96 }}
          ListEmptyComponent={
            <VStack gap={2} className="pt-8 items-center">
              <Text tone="muted" className="text-center">
                {t('village.history.empty')}
              </Text>
              {isMember ? (
                <Text tone="muted" variant="bodySm" className="text-center">
                  {t('village.history.emptyMember')}
                </Text>
              ) : null}
            </VStack>
          }
          renderItem={({ item: row }) =>
            row.type === 'century' ? (
              <HStack gap={2} className="items-center" testID={`history-${row.key}`}>
                <Rail dot={false} />
                <Text variant="bodySm" tone="muted" className="font-bold uppercase py-3">
                  {historicalCenturyLabel(row.century)}
                </Text>
              </HStack>
            ) : (
              <Pressable
                onPress={() =>
                  router.push(`/village/${villageId}/history-entry/${row.entry.id}` as never)
                }
                testID={`history-entry-${row.entry.id}`}
                accessibilityRole="button"
              >
                <HStack gap={2}>
                  <Rail dot />
                  <HStack gap={3} className="flex-1 items-center py-3 border-b border-subtle">
                    <VStack gap={1} className="flex-1">
                      <Text variant="bodySm" className="font-bold text-accent">
                        {formatHistoryEntryDate(row.entry)}
                      </Text>
                      <Text className="font-bold" numberOfLines={2}>
                        {row.entry.title}
                      </Text>
                      {row.entry.body.text ? (
                        <Text tone="muted" variant="bodySm" numberOfLines={2}>
                          {row.entry.body.text}
                        </Text>
                      ) : null}
                    </VStack>
                    {row.entry.images[0] ? (
                      <View className="rounded-md overflow-hidden" style={{ width: THUMB, height: THUMB }}>
                        <RemoteImage
                          uri={row.entry.images[0].url}
                          variant="thumb"
                          style={{ width: THUMB, height: THUMB }}
                          contentFit="cover"
                          accessibilityLabel={row.entry.title}
                        />
                      </View>
                    ) : null}
                  </HStack>
                </HStack>
              </Pressable>
            )
          }
        />
      )}
      {isMember ? (
        <Fab
          label={t('village.history.add')}
          onPress={() => router.push(`/village/${villageId}/history-entry/new` as never)}
          testID="history-add-fab"
        />
      ) : null}
    </Screen>
  );
}
