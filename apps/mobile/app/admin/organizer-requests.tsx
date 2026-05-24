import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, ActivityIndicator } from 'react-native';
import { Screen, VStack, HStack, Text, Button } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useT } from '../../lib/i18n';
import {
  getPendingOrganizerRequests,
  respondToOrganizerRequest,
} from '@cultuvilla/shared/services/organizerRequestService';
import type { OrganizerRequestData } from '@cultuvilla/shared/models/municipality/OrganizerRequestDataModel';

type Row = OrganizerRequestData & { id: string };

export default function OrganizerRequestsScreen() {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await getPendingOrganizerRequests());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(req: Row, decision: 'approved' | 'rejected') {
    setBusyId(req.id);
    try {
      await respondToOrganizerRequest({
        requestId: req.id,
        decision,
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('admin.organizerRequests.title')} />
      {rows === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : rows.length === 0 ? (
        <View className="p-4">
          <Text>{t('admin.organizerRequests.empty')}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <VStack gap={2} className="bg-surface border border-subtle rounded-xl p-3">
              <Text variant="h3">{item.userId}</Text>
              <Text className="text-muted text-sm">{item.municipalityId}</Text>
              <HStack gap={2}>
                <Button
                  onPress={() => decide(item, 'approved')}
                  loading={busyId === item.id}
                >
                  {t('admin.organizerRequests.approve')}
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => decide(item, 'rejected')}
                  loading={busyId === item.id}
                >
                  {t('admin.organizerRequests.reject')}
                </Button>
              </HStack>
            </VStack>
          )}
        />
      )}
    </Screen>
  );
}
