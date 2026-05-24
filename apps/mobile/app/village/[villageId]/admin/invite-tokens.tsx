import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Alert, Share } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Pressable } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import {
  createInviteToken,
  getInviteTokens,
  deleteInviteToken,
} from '@cultuvilla/shared/services/inviteTokenService';
import type { InviteTokenData } from '@cultuvilla/shared/models/municipality';

type Row = InviteTokenData & { id: string };

export default function InviteTokensScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getInviteTokens(villageId));
  }, [villageId]);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    if (!villageId) return;
    setBusy(true);
    try { await createInviteToken(villageId); await load(); } finally { setBusy(false); }
  }

  async function share(r: Row) {
    const url = `https://cultuvilla.app/invite/${r.id}`;
    await Share.share({ message: url, url });
  }

  function remove(r: Row) {
    Alert.alert(t('common.delete'), r.id, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!villageId) return;
          await deleteInviteToken(villageId, r.id);
          await load();
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.invites.title')} />
      <VStack gap={3} className="p-4">
        <Button onPress={create} loading={busy}>
          {t('village.admin.invites.create')}
        </Button>
        <FlatList
          data={rows ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View className="py-3 border-b border-subtle">
              <HStack gap={2}>
                <Text className="flex-1 font-mono text-xs">{item.id}</Text>
                <Pressable onPress={() => share(item)}>
                  <Text className="text-blue-600">{t('village.admin.invites.copy')}</Text>
                </Pressable>
                <Pressable onPress={() => remove(item)}>
                  <Text className="text-red-600">{t('village.admin.invites.delete')}</Text>
                </Pressable>
              </HStack>
            </View>
          )}
          ListEmptyComponent={
            rows && rows.length === 0 ? (
              <Text className="text-muted">{t('village.admin.invites.empty')}</Text>
            ) : null
          }
        />
      </VStack>
    </Screen>
  );
}
