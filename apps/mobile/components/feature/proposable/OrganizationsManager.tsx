import { useCallback, useEffect, useState } from 'react';
import {
  getOrganizationsByMunicipality, requestOrganization, newOrganizationId, approveOrganization, rejectOrganization, deleteOrganization,
} from '@cultuvilla/shared/services/organizationService';
import { uploadOrganizationImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import {
  PROPOSABLE_ORGANIZATION_TYPES,
  type OrganizationData,
  type OrganizationType,
} from '@cultuvilla/shared/models/organization/OrganizationDataModel';
import { VStack, Text } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { isProposalVisible } from '../../../lib/proposals';
import { ProposableListItem } from './ProposableListItem';
import { ProposableForm } from './ProposableForm';
import type { ManagerMode } from './types';

type Row = OrganizationData & { id: string };

/**
 * Shared Organizations (agrupaciones) surface, split by `mode`:
 * - `create` (default): just the "Añadir agrupación" form. A villager proposes
 *   a peña/asociación/otros (pending); an organizer proposes-then-auto-approves.
 *   Calls `onCreated` after submit.
 * - `manage`: the moderation list (approve/reject/delete), behind the admin-only
 *   community screen. Org rules forbid member edit/withdraw, so proposers get no
 *   edit/withdraw affordance.
 */
export function OrganizationsManager({
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
  const [type, setType] = useState<OrganizationType>('peña');
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [saving, setSaving] = useState(false);

  // Load all statuses; the list is filtered in the UI (isProposalVisible) so a
  // villager sees approved orgs + their own pending, an organizer sees all.
  const load = useCallback(async () => {
    if (!villageId) return;
    setRows(await getOrganizationsByMunicipality(villageId));
  }, [villageId]);

  useEffect(() => {
    if (mode === 'manage') void load();
  }, [mode, load]);

  async function submit() {
    if (!villageId || !name.trim() || !uid) return;
    setSaving(true);
    try {
      // Mint the id first so the image can be uploaded to the org's storage
      // path and its URL written in the create payload — proposers can't update
      // the doc afterwards (org update is admin-only).
      const id = newOrganizationId();
      const imageURL = image ? await uploadOrganizationImage(id, image) : null;
      await requestOrganization({
        id,
        name: name.trim(),
        description: description.trim() || null,
        imageURL,
        type,
        municipalityId: villageId,
        requestedBy: uid,
        status: 'pending',
      });
      // Organizer commit: the create path is always pending; auto-approve so the
      // round-trip is invisible (single rules surface + full audit trail).
      if (canManage) await approveOrganization(id, uid, uid);
      setName('');
      setDescription('');
      setType('peña');
      setImage(null);
      onCreated?.();
    } finally {
      setSaving(false);
    }
  }

  const typeLabel = (ty: OrganizationType) => t(`organization.${ty}`);

  if (mode === 'create') {
    return (
      <VStack gap={3} className="p-4">
        <ProposableForm
          image={image}
          onImageChange={setImage}
          imageLabels={{
            add: t('organization.addImage'),
            selected: t('organization.imageSelected'),
          }}
          name={name}
          onChangeName={setName}
          nameLabel={t('organization.name')}
          nameTestID="org-name-input"
          description={description}
          onChangeDescription={setDescription}
          descriptionLabel={t('organization.description')}
          typeLabel={t('organization.type')}
          typeOptions={PROPOSABLE_ORGANIZATION_TYPES.map((ty) => ({ value: ty, label: typeLabel(ty) }))}
          typeValue={type}
          onChangeType={(v) => setType(v as OrganizationType)}
          submitLabel={canManage ? t('village.admin.organizations.add') : t('village.proposals.propose')}
          submitTestID="org-submit"
          onSubmit={submit}
          saving={saving}
          disabled={!name.trim()}
        />
      </VStack>
    );
  }

  // mode === 'manage': moderation list (mapped, not FlatList, so it nests in the
  // community screen's ScrollView).
  const visible = (rows ?? []).filter((r) => isProposalVisible(r.status, r.requestedBy, { canManage, uid }));
  return (
    <VStack gap={0} className="px-4">
      {rows && visible.length === 0 ? (
        <Text className="text-muted">{t('village.organizationsList.empty')}</Text>
      ) : null}
      {visible.map((item) => (
        <ProposableListItem
          key={item.id}
          name={item.name}
          imageURL={item.imageURL}
          subtitle={typeLabel(item.type)}
          status={item.status}
          canManage={canManage}
          isOwnPending={false}
          onApprove={uid ? () => void approveOrganization(item.id, uid, item.requestedBy).then(load) : undefined}
          onReject={() => void rejectOrganization(item.id).then(load)}
          onDelete={() => void deleteOrganization(item.id).then(load)}
        />
      ))}
    </VStack>
  );
}
