import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { useAuth } from '../../../../lib/auth/useAuth';
import {
  getOrganizationsByMunicipality,
  approveOrganization,
  rejectOrganization,
} from '@cultuvilla/shared/services/organizationService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization';

type Row = OrganizationData & { id: string };

export default function OrganizationsScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getOrganizationsByMunicipality(villageId));
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(r: Row) {
    if (!user) return;
    setBusyId(r.id);
    try { await approveOrganization(r.id, user.uid); await load(); } finally { setBusyId(null); }
  }
  async function reject(r: Row) {
    setBusyId(r.id);
    try { await rejectOrganization(r.id); await load(); } finally { setBusyId(null); }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.organizations.title')} />
      {rows === null ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : rows.length === 0 ? (
        <View className="p-4"><Text>{t('village.admin.organizations.empty')}</Text></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <VStack gap={2} className="bg-surface border border-subtle rounded-xl p-3">
              <Text variant="h3">{item.name}</Text>
              <Text className="text-muted text-sm">{item.status}</Text>
              {item.status === 'pending' ? (
                <HStack gap={2}>
                  <Button onPress={() => approve(item)} loading={busyId === item.id}>
                    {t('village.admin.organizations.approve')}
                  </Button>
                  <Button variant="ghost" onPress={() => reject(item)} loading={busyId === item.id}>
                    {t('village.admin.organizations.reject')}
                  </Button>
                </HStack>
              ) : null}
            </VStack>
          )}
        />
      )}
    </Screen>
  );
}
