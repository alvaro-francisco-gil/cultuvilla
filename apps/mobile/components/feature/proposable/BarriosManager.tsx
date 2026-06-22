import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import {
  getBarrios, createBarrio, proposeBarrio, approveBarrio, rejectBarrio, updateBarrio, deleteBarrio,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadBarrioImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import type { BarrioData } from '@cultuvilla/shared/models/municipality';
import { VStack, HStack, Text, Button, Input, Pressable, Avatar } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { pickImageAsBlob } from '../../../lib/images';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { isProposalVisible } from '../../../lib/proposals';
import { ProposableListItem } from './ProposableListItem';

type Row = BarrioData & { id: string };

/**
 * Shared Barrios surface. A villager proposes (pending); an organizer
 * (village/app admin) creates directly, approves/rejects, and deletes.
 * A proposer can edit/withdraw their own still-pending barrio.
 */
export function BarriosManager({ villageId }: { villageId: string }) {
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
    void load();
  }, [load]);

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

  // No Alert.alert confirm: Alert is a no-op on web (the shared surface runs on
  // web). Withdraw/delete act directly; a future confirm dialog can be added.
  async function remove(id: string) {
    if (!villageId) return;
    await deleteBarrio(villageId, id);
    await load();
  }

  return (
    <VStack gap={3} className="p-4">
      <HStack gap={2} align="center">
        <Pressable
          onPress={async () => {
            const picked = await pickImageAsBlob();
            if (picked) setImage(picked);
          }}
          accessibilityLabel={image ? t('village.admin.barrios.changeImage') : t('village.admin.barrios.addImage')}
        >
          <Avatar size={48} initials={image ? '✓' : '+'} />
        </Pressable>
        <View className="flex-1">
          <Input testID="barrio-name-input" value={name} onChangeText={setName} placeholder={t('village.admin.barrios.name')} />
        </View>
        <Button testID="barrio-submit" onPress={submit} loading={saving} disabled={!name.trim()}>
          {canManage ? t('village.admin.barrios.add') : t('village.proposals.propose')}
        </Button>
      </HStack>
      {image ? <Text tone="muted" variant="bodySm">{t('village.admin.barrios.imageSelected')}</Text> : null}
      <FlatList
        data={(rows ?? []).filter((r) => isProposalVisible(r.status, r.proposedBy, { canManage, uid }))}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) =>
          editingId === item.id ? (
            <HStack gap={2} className="py-3">
              <View className="flex-1">
                <Input value={editName} onChangeText={setEditName} />
              </View>
              <Button onPress={saveEdit} loading={saving}>{t('common.save')}</Button>
              <Button variant="ghost" onPress={() => setEditingId(null)}>{t('common.cancel')}</Button>
            </HStack>
          ) : (
            <ProposableListItem
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
          )
        }
        ListEmptyComponent={rows && rows.length === 0 ? <Text className="text-muted">{t('village.admin.barrios.empty')}</Text> : null}
      />
    </VStack>
  );
}
