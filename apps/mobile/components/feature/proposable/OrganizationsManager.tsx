import { useCallback, useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import {
  getOrganizationsByMunicipality, requestOrganization, approveOrganization, rejectOrganization, deleteOrganization,
} from '@cultuvilla/shared/services/organizationService';
import type { OrganizationData, OrganizationType } from '@cultuvilla/shared/models/organization/OrganizationDataModel';
import { VStack, HStack, Text, Button, Input, Pressable } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { ProposableListItem } from './ProposableListItem';

type Row = OrganizationData & { id: string };

// The inline propose form covers the client-creatable types. Ayuntamiento is a
// singleton created via the requestAyuntamiento callable, handled elsewhere.
const TYPES: OrganizationType[] = ['peña', 'asociación'];

/**
 * Shared Organizations surface. A villager proposes a peña/asociación (pending,
 * visible to all); an organizer proposes-then-auto-approves, and approves/rejects/
 * deletes others. Org rules forbid member edit/withdraw, so proposers get no
 * edit/withdraw affordance here.
 */
export function OrganizationsManager({ villageId }: { villageId: string }) {
  const { t } = useT();
  const { canManage, uid } = useEntityCapabilities(villageId);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OrganizationType>('peña');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getOrganizationsByMunicipality(villageId));
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!villageId || !name.trim() || !uid) return;
    setSaving(true);
    try {
      const id = await requestOrganization({
        name: name.trim(),
        description: description.trim() || null,
        type,
        municipalityId: villageId,
        requestedBy: uid,
        status: 'pending',
      });
      // Organizer commit: the create path is always pending; auto-approve so the
      // round-trip is invisible (single rules surface + full audit trail).
      if (canManage) await approveOrganization(id, uid);
      setName('');
      setDescription('');
      setType('peña');
      await load();
    } finally {
      setSaving(false);
    }
  }

  const typeLabel = (ty: OrganizationType) => t(`organization.${ty}`);

  const TypePicker = () => (
    <HStack gap={2} className="flex-wrap">
      {TYPES.map((ty) => (
        <Pressable
          key={ty}
          onPress={() => setType(ty)}
          className={`px-3 py-1 rounded-full border ${type === ty ? 'bg-blue-600 border-blue-600' : 'border-subtle'}`}
        >
          <Text className={type === ty ? 'text-white' : undefined}>{typeLabel(ty)}</Text>
        </Pressable>
      ))}
    </HStack>
  );

  return (
    <VStack gap={3} className="p-4">
      <VStack gap={2}>
        <Input testID="org-name-input" value={name} onChangeText={setName} placeholder={t('organization.name')} />
        <Input value={description} onChangeText={setDescription} placeholder={t('organization.description')} multiline />
        <TypePicker />
        <Button testID="org-submit" onPress={submit} loading={saving} disabled={!name.trim()}>
          {canManage ? t('village.admin.organizations.add') : t('village.proposals.propose')}
        </Button>
      </VStack>
      <FlatList
        data={rows ?? []}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <ProposableListItem
            name={item.name}
            imageURL={item.imageURL}
            subtitle={typeLabel(item.type)}
            status={item.status}
            canManage={canManage}
            isOwnPending={false}
            onApprove={uid ? () => void approveOrganization(item.id, uid).then(load) : undefined}
            onReject={() => void rejectOrganization(item.id).then(load)}
            onDelete={() => void deleteOrganization(item.id).then(load)}
          />
        )}
        ListEmptyComponent={rows && rows.length === 0 ? <Text className="text-muted">{t('village.organizationsList.empty')}</Text> : null}
      />
    </VStack>
  );
}
