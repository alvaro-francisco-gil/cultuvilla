import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  getPlaces, createPlace, proposePlace, approvePlace, rejectPlace, updatePlace, deletePlace,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadPlaceImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import type { PlaceData, PlaceKind } from '@cultuvilla/shared/models/municipality';
import { VStack, HStack, Text, Button, Input, Pressable, Avatar } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { pickImageAsBlob } from '../../../lib/images';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { ProposableListItem } from './ProposableListItem';

type Row = PlaceData & { id: string };
const KINDS: PlaceKind[] = ['cemetery', 'church', 'hermitage', 'plaza', 'town_hall'];

/**
 * Shared Lugares (places) surface. A villager proposes (pending); an organizer
 * creates directly, approves/rejects, and deletes. A proposer can edit/withdraw
 * their own still-pending place.
 */
export function PlacesManager({ villageId }: { villageId: string }) {
  const { t } = useT();
  const { canManage, uid } = useEntityCapabilities(villageId);
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

  async function submit() {
    if (!villageId || !name.trim() || !uid) return;
    setSaving(true);
    try {
      const input = { name: name.trim(), kind, description: description.trim(), municipalityId: villageId };
      const id = canManage
        ? await createPlace(villageId, input)
        : await proposePlace(villageId, { ...input, proposedBy: uid });
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
        name: editName.trim(), kind: editKind, description: editDescription.trim(),
      });
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  // No Alert.alert confirm — Alert is a no-op on web (the shared surface runs on web).
  async function remove(id: string) {
    if (!villageId) return;
    await deletePlace(villageId, id);
    await load();
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
            className={`px-3 py-1 rounded-full border ${value === k ? 'bg-blue-600 border-blue-600' : 'border-subtle'}`}
          >
            <Text className={value === k ? 'text-white' : undefined}>{kindLabel(k)}</Text>
          </Pressable>
        ))}
      </HStack>
    </VStack>
  );

  return (
    <VStack gap={3} className="p-4">
      <VStack gap={2}>
        <Input testID="place-name-input" value={name} onChangeText={setName} placeholder={t('village.admin.places.name')} />
        <Input value={description} onChangeText={setDescription} placeholder={t('village.admin.places.description')} multiline />
        <KindPicker value={kind} onChange={setKind} />
        <HStack gap={2} align="center">
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
        <Button testID="place-submit" onPress={submit} loading={saving} disabled={!name.trim()}>
          {canManage ? t('village.admin.places.add') : t('village.proposals.propose')}
        </Button>
      </VStack>
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) =>
          editingId === item.id ? (
            <VStack gap={2} className="py-3">
              <Input value={editName} onChangeText={setEditName} />
              <Input value={editDescription} onChangeText={setEditDescription} multiline />
              <KindPicker value={editKind} onChange={setEditKind} />
              <HStack gap={2}>
                <Button onPress={saveEdit} loading={saving}>{t('common.save')}</Button>
                <Button variant="ghost" onPress={() => setEditingId(null)}>{t('common.cancel')}</Button>
              </HStack>
            </VStack>
          ) : (
            <ProposableListItem
              name={item.name}
              imageURL={item.imageURL}
              subtitle={kindLabel(item.kind)}
              status={item.status}
              canManage={canManage}
              isOwnPending={!canManage && item.status === 'pending' && item.proposedBy === uid}
              onApprove={uid ? () => void approvePlace(villageId, item.id, uid).then(load) : undefined}
              onReject={() => void rejectPlace(villageId, item.id).then(load)}
              onEdit={() => {
                setEditingId(item.id);
                setEditName(item.name);
                setEditDescription(item.description ?? '');
                setEditKind(item.kind);
              }}
              onWithdraw={() => void remove(item.id)}
              onDelete={() => void remove(item.id)}
            />
          )
        }
        ListEmptyComponent={rows && rows.length === 0 ? <Text className="text-muted">{t('village.admin.places.empty')}</Text> : null}
      />
    </VStack>
  );
}
