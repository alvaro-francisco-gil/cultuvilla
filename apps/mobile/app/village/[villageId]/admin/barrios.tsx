import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Input, Pressable } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import {
  getBarrios,
  createBarrio,
  updateBarrio,
  deleteBarrio,
} from '@cultuvilla/shared/services/municipalityService';
import type { BarrioData } from '@cultuvilla/shared/models/municipality';

type Row = BarrioData & { id: string };

export default function BarriosScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getBarrios(villageId));
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!villageId || !name.trim()) return;
    setSaving(true);
    try {
      await createBarrio(villageId, { name: name.trim(), municipalityId: villageId });
      setName('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!villageId || !editingId || !editName.trim()) return;
    setSaving(true);
    try {
      await updateBarrio(villageId, editingId, { name: editName.trim() });
      setEditingId(null);
      setEditName('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  function remove(r: Row) {
    // mobile-web-compat: native-only — admin surface, not exercised on web
    Alert.alert(t('common.delete'), r.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!villageId) return;
          await deleteBarrio(villageId, r.id);
          await load();
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.barrios.title')} />
      <VStack gap={3} className="p-4">
        <HStack gap={2}>
          <View className="flex-1">
            <Input
              value={name}
              onChangeText={setName}
              placeholder={t('village.admin.barrios.name')}
            />
          </View>
          <Button onPress={add} loading={saving} disabled={!name.trim()}>
            {t('village.admin.barrios.add')}
          </Button>
        </HStack>
        <FlatList
          data={rows ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View className="py-3 border-b border-subtle">
              {editingId === item.id ? (
                <HStack gap={2}>
                  <View className="flex-1">
                    <Input value={editName} onChangeText={setEditName} />
                  </View>
                  <Button onPress={saveEdit} loading={saving}>
                    {t('common.save')}
                  </Button>
                  <Button variant="ghost" onPress={() => setEditingId(null)}>
                    {t('common.cancel')}
                  </Button>
                </HStack>
              ) : (
                <HStack gap={2}>
                  <Text className="flex-1">{item.name}</Text>
                  <Pressable onPress={() => { setEditingId(item.id); setEditName(item.name); }}>
                    <Text className="text-blue-600">{t('common.edit')}</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(item)}>
                    <Text className="text-red-600">{t('common.delete')}</Text>
                  </Pressable>
                </HStack>
              )}
            </View>
          )}
          ListEmptyComponent={
            rows && rows.length === 0 ? (
              <Text className="text-muted">{t('village.admin.barrios.empty')}</Text>
            ) : null
          }
        />
      </VStack>
    </Screen>
  );
}
