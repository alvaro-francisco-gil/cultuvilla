import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  getBarrios, createBarrio, proposeBarrio, approveBarrio, rejectBarrio, updateBarrio, deleteBarrio,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadBarrioImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import type { BarrioData } from '@cultuvilla/shared/models/municipality';
import { VStack, HStack, Text, Button, Input } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { isProposalVisible } from '../../../lib/proposals';
import { ProposableListItem } from './ProposableListItem';
import { ProposableForm } from './ProposableForm';
import type { ManagerMode } from './types';

type Row = BarrioData & { id: string };

/**
 * Shared Barrios surface, split by `mode`:
 * - `create` (default): just the "Añadir barrio" form. A villager proposes
 *   (pending); an organizer creates directly. Calls `onCreated` after submit.
 * - `manage`: the moderation list (approve/reject/edit/delete), behind the
 *   admin-only community screen.
 */
export function BarriosManager({
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
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getBarrios(villageId));
  }, [villageId]);

  useEffect(() => {
    if (mode === 'manage') void load();
  }, [mode, load]);

  async function submit() {
    if (!villageId || !name.trim() || !uid) return;
    setSaving(true);
    try {
      const id = canManage
        ? await createBarrio(villageId, { name: name.trim(), municipalityId: villageId })
        : await proposeBarrio(villageId, { name: name.trim(), municipalityId: villageId, proposedBy: uid });
      if (image) {
        const imageURL = await uploadBarrioImage(villageId, id, image);
        await updateBarrio(villageId, id, { imageURL });
      }
      setName('');
      setImage(null);
      onCreated?.();
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

  // No Alert.alert confirm: Alert is a no-op on web (the shared surface runs on
  // web). Withdraw/delete act directly; a future confirm dialog can be added.
  async function remove(id: string) {
    if (!villageId) return;
    await deleteBarrio(villageId, id);
    await load();
  }

  if (mode === 'create') {
    return (
      <VStack gap={3} className="p-4">
        <ProposableForm
          title={t('village.admin.barrios.add')}
          image={image}
          onImageChange={setImage}
          imageLabels={{
            add: t('village.admin.barrios.addImage'),
            selected: t('village.admin.barrios.imageSelected'),
          }}
          name={name}
          onChangeName={setName}
          namePlaceholder={t('village.admin.barrios.name')}
          nameTestID="barrio-name-input"
          submitLabel={canManage ? t('village.admin.barrios.add') : t('village.proposals.propose')}
          submitTestID="barrio-submit"
          onSubmit={submit}
          saving={saving}
          disabled={!name.trim()}
        />
      </VStack>
    );
  }

  // mode === 'manage': moderation list (mapped, not FlatList, so it nests in the
  // community screen's ScrollView).
  const visible = (rows ?? []).filter((r) => isProposalVisible(r.status, r.proposedBy, { canManage, uid }));
  return (
    <VStack gap={0} className="px-4">
      {rows && visible.length === 0 ? (
        <Text className="text-muted">{t('village.admin.barrios.empty')}</Text>
      ) : null}
      {visible.map((item) =>
        editingId === item.id ? (
          <HStack key={item.id} gap={2} className="py-3">
            <View className="flex-1">
              <Input value={editName} onChangeText={setEditName} />
            </View>
            <Button onPress={saveEdit} loading={saving}>{t('common.save')}</Button>
            <Button variant="ghost" onPress={() => setEditingId(null)}>{t('common.cancel')}</Button>
          </HStack>
        ) : (
          <ProposableListItem
            key={item.id}
            name={item.name}
            imageURL={item.imageURL}
            status={item.status}
            canManage={canManage}
            isOwnPending={!canManage && item.status === 'pending' && item.proposedBy === uid}
            onApprove={uid ? () => void approveBarrio(villageId, item.id, uid).then(load) : undefined}
            onReject={() => void rejectBarrio(villageId, item.id).then(load)}
            onEdit={() => { setEditingId(item.id); setEditName(item.name); }}
            onWithdraw={() => void remove(item.id)}
            onDelete={() => void remove(item.id)}
          />
        ),
      )}
    </VStack>
  );
}
