import { useCallback, useEffect, useState } from 'react';
import { FlatList, ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { useAuth } from '../../../../lib/auth/useAuth';
import { isVillageAdmin } from '@cultuvilla/shared/services/villageMemberService';
import {
  getJoinRequestsForVillage,
  respondToJoinRequest,
} from '@cultuvilla/shared/services/joinRequestService';
import type { JoinRequestData } from '@cultuvilla/shared/models/municipality';

type Row = JoinRequestData & { id: string };

export default function VillageAdminRequestsScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { user } = useAuth();
  const { t } = useT();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !villageId) return;
    void isVillageAdmin(villageId, user.uid).then(setAllowed);
  }, [user, villageId]);

  const load = useCallback(async () => {
    if (!villageId) return;
    const r = await getJoinRequestsForVillage(villageId, 'pending');
    setRows(r);
  }, [villageId]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  async function decide(userId: string, decision: 'approved' | 'rejected') {
    if (!villageId) return;
    setBusyId(userId);
    try {
      await respondToJoinRequest({ municipalityId: villageId, userId, decision });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (allowed === null) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('requests.admin.title')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }
  if (!allowed) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('requests.admin.title')} />
        <View className="p-4">
          <Text tone="danger">403</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('requests.admin.title')} />
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.id}
        contentContainerClassName="p-4 gap-3"
        ListEmptyComponent={<Text tone="muted">{t('requests.admin.empty')}</Text>}
        renderItem={({ item }) => (
          <View className="p-3 border border-subtle rounded-md bg-surface">
            <VStack gap={2}>
              <Text>{item.userId}</Text>
              {item.message && <Text tone="muted">{item.message}</Text>}
              <HStack gap={2}>
                <Button
                  onPress={() => decide(item.userId, 'approved')}
                  loading={busyId === item.userId}
                >
                  <Text tone="onAccent">{t('requests.admin.approve')}</Text>
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => decide(item.userId, 'rejected')}
                  loading={busyId === item.userId}
                >
                  <Text>{t('requests.admin.reject')}</Text>
                </Button>
              </HStack>
            </VStack>
          </View>
        )}
      />
    </Screen>
  );
}
