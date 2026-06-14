import { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen, VStack, HStack, Text, Button, Input, Pressable, Avatar } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { pickImageAsBlob } from '../../../../lib/images';
import {
  getPlaces,
  createPlace,
  updatePlace,
  deletePlace,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadPlaceImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import type { PlaceData, PlaceKind } from '@cultuvilla/shared/models/municipality';

type Row = PlaceData & { id: string };

const KINDS: PlaceKind[] = ['cemetery', 'church', 'hermitage', 'plaza', 'town_hall'];

export default function PlacesScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<PlaceKind>('cemetery');
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editKind, setEditKind] = useState<PlaceKind>('cemetery');

  const kindLabel = (k: PlaceKind) => t(`village.admin.places.kind.${k}`);

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getPlaces(villageId));
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!villageId || !name.trim()) return;
    setSaving(true);
    try {
      const id = await createPlace(villageId, {
        name: name.trim(),
        kind,
        description: description.trim(),
        municipalityId: villageId,
      });
      if (image) {
        const imageURL = await uploadPlaceImage(villageId, id, image);
        await updatePlace(villageId, id, { imageURL });
      }
      setName('');
      setDescription('');
      setKind('cemetery');
      setImage(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!villageId || !editingId) return;
    setSaving(true);
    try {
      await updatePlace(villageId, editingId, {
        name: editName.trim(),
        kind: editKind,
        description: editDescription.trim(),
      });
      setEditingId(null);
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
          await deletePlace(villageId, r.id);
          await load();
        },
      },
    ]);
  }

  // Chip-row selector — avoids Modal/Picker for mobile-web-compat.
  const KindPicker = ({ value, onChange }: { value: PlaceKind; onChange: (k: PlaceKind) => void }) => (
    <VStack gap={1}>
      <Text className="text-muted text-sm">{t('village.admin.places.kindLabel')}</Text>
      <HStack gap={2} className="flex-wrap">
        {KINDS.map((k) => (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            className={`px-3 py-1 rounded-full border ${
              value === k ? 'bg-blue-600 border-blue-600' : 'border-subtle'
            }`}
          >
            <Text className={value === k ? 'text-white' : undefined}>{kindLabel(k)}</Text>
          </Pressable>
        ))}
      </HStack>
    </VStack>
  );

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.places.title')} />
      <VStack gap={3} className="p-4">
        <VStack gap={2}>
          <Input value={name} onChangeText={setName} placeholder={t('village.admin.places.name')} />
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder={t('village.admin.places.description')}
            multiline
          />
          <KindPicker value={kind} onChange={setKind} />
          <HStack gap={2} className="items-center">
            <Pressable
              onPress={async () => {
                const picked = await pickImageAsBlob();
                if (picked) setImage(picked);
              }}
              accessibilityLabel={image ? t('village.admin.places.changeImage') : t('village.admin.places.addImage')}
            >
              <Avatar size={48} initials={image ? '✓' : '+'} />
            </Pressable>
            <Text tone="muted" variant="bodySm">
              {image ? t('village.admin.places.imageSelected') : t('village.admin.places.addImage')}
            </Text>
          </HStack>
          <Button onPress={add} loading={saving} disabled={!name.trim()}>
            {t('village.admin.places.add')}
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
                  <KindPicker value={editKind} onChange={setEditKind} />
                  <HStack gap={2}>
                    <Button onPress={saveEdit} loading={saving}>{t('common.save')}</Button>
                    <Button variant="ghost" onPress={() => setEditingId(null)}>{t('common.cancel')}</Button>
                  </HStack>
                </VStack>
              ) : (
                <HStack gap={2} className="items-center">
                  <Avatar uri={item.imageURL} size={40} initials={item.name.slice(0, 1)} />
                  <View className="flex-1">
                    <Text>{item.name}</Text>
                    <Text className="text-muted text-sm">{kindLabel(item.kind)}</Text>
                    {item.description ? (
                      <Text className="text-muted text-sm">{item.description}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditingId(item.id);
                      setEditName(item.name);
                      setEditDescription(item.description ?? '');
                      setEditKind(item.kind);
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
              <Text className="text-muted">{t('village.admin.places.empty')}</Text>
            ) : null
          }
        />
      </VStack>
    </Screen>
  );
}
