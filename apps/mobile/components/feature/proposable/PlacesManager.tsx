import { useCallback, useEffect, useState } from 'react';
import {
  getPlaces, createPlace, proposePlace, approvePlace, rejectPlace, updatePlace, deletePlace,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadPlaceImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { PLACE_KINDS, type PlaceData, type PlaceKind } from '@cultuvilla/shared/models/municipality';
import { VStack, HStack, Text, Button, Input, Pressable, FieldLabel } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { isProposalVisible } from '../../../lib/proposals';
import { ProposableListItem } from './ProposableListItem';
import { ProposableForm } from './ProposableForm';
import type { ManagerMode } from './types';

type Row = PlaceData & { id: string };

/**
 * Shared Lugares (places) surface, split by `mode`:
 * - `create` (default): just the "Añadir lugar" form. A villager proposes
 *   (pending); an organizer creates directly. Calls `onCreated` after submit.
 * - `manage`: the moderation list (approve/reject/edit/delete). Lives behind the
 *   admin-only community screen. A proposer can edit/withdraw their own pending
 *   place here too, but the pueblo-tab card is their usual entry point.
 */
export function PlacesManager({
  villageId,
  mode = 'create',
  onCreated,
}: {
  villageId: string;
  mode?: ManagerMode;
  onCreated?: () => void;
}) {
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
    if (mode === 'manage') void load();
  }, [mode, load]);

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
      onCreated?.();
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
      <FieldLabel>{t('village.admin.places.kindLabel')}</FieldLabel>
      <HStack gap={2} className="flex-wrap">
        {PLACE_KINDS.map((k) => (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            className={`px-3 py-1 rounded-full border ${value === k ? 'bg-[#f3a64b] border-[#f3a64b]' : 'border-subtle'}`}
          >
            <Text className={value === k ? 'text-primary' : undefined}>{kindLabel(k)}</Text>
          </Pressable>
        ))}
      </HStack>
    </VStack>
  );

  if (mode === 'create') {
    return (
      <VStack gap={3} className="p-4">
        <ProposableForm
          image={image}
          onImageChange={setImage}
          imageLabels={{
            add: t('village.admin.places.addImage'),
            selected: t('village.admin.places.imageSelected'),
          }}
          name={name}
          onChangeName={setName}
          nameLabel={t('village.admin.places.name')}
          nameTestID="place-name-input"
          description={description}
          onChangeDescription={setDescription}
          descriptionLabel={t('village.admin.places.description')}
          typeLabel={t('village.admin.places.kindLabel')}
          typeOptions={PLACE_KINDS.map((k) => ({ value: k, label: kindLabel(k) }))}
          typeValue={kind}
          onChangeType={(v) => setKind(v as PlaceKind)}
          submitLabel={canManage ? t('village.admin.places.add') : t('village.proposals.propose')}
          submitTestID="place-submit"
          onSubmit={submit}
          saving={saving}
          disabled={!name.trim()}
        />
      </VStack>
    );
  }

  // mode === 'manage': moderation list (no FlatList, so it nests in the
  // community screen's ScrollView without a nested-VirtualizedList warning).
  const visible = (rows ?? []).filter((r) => isProposalVisible(r.status, r.proposedBy, { canManage, uid }));
  return (
    <VStack gap={0} className="px-4">
      {rows && visible.length === 0 ? (
        <Text className="text-muted">{t('village.admin.places.empty')}</Text>
      ) : null}
      {visible.map((item) =>
        editingId === item.id ? (
          <VStack key={item.id} gap={2} className="py-3">
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
            key={item.id}
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
        ),
      )}
    </VStack>
  );
}
