import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Input, Pressable } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import {
  getCemeteries,
  createCemetery,
  updateCemetery,
  deleteCemetery,
} from '@cultuvilla/shared/services/municipalityService';
import type { CemeteryData } from '@cultuvilla/shared/models/municipality';

type Row = CemeteryData & { id: string };

export default function CemeteriesScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getCemeteries(villageId));
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!villageId || !name.trim()) return;
    setSaving(true);
    try {
      await createCemetery(villageId, {
        name: name.trim(),
        description: description.trim(),
        municipalityId: villageId,
      });
      setName('');
      setDescription('');
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!villageId || !editingId) return;
    setSaving(true);
    try {
      await updateCemetery(villageId, editingId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  function remove(r: Row) {
    Alert.alert(t('common.delete'), r.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!villageId) return;
          await deleteCemetery(villageId, r.id);
          await load();
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.cemeteries.title')} />
      <VStack gap={3} className="p-4">
        <VStack gap={2}>
          <Input value={name} onChangeText={setName} placeholder={t('village.admin.cemeteries.name')} />
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder={t('village.admin.cemeteries.description')}
            multiline
          />
          <Button onPress={add} loading={saving} disabled={!name.trim()}>
            {t('village.admin.cemeteries.add')}
          </Button>
        </VStack>
        <FlatList
          data={rows ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View className="py-3 border-b border-subtle">
              {editingId === item.id ? (
                <VStack gap={2}>
                  <Input value={editName} onChangeText={setEditName} />
                  <Input value={editDescription} onChangeText={setEditDescription} multiline />
                  <HStack gap={2}>
                    <Button onPress={saveEdit} loading={saving}>{t('common.save')}</Button>
                    <Button variant="ghost" onPress={() => setEditingId(null)}>{t('common.cancel')}</Button>
                  </HStack>
                </VStack>
              ) : (
                <HStack gap={2}>
                  <View className="flex-1">
                    <Text>{item.name}</Text>
                    {item.description ? (
                      <Text className="text-muted text-sm">{item.description}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditingId(item.id);
                      setEditName(item.name);
                      setEditDescription(item.description ?? '');
                    }}
                  >
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
              <Text className="text-muted">{t('village.admin.cemeteries.empty')}</Text>
            ) : null
          }
        />
      </VStack>
    </Screen>
  );
}
