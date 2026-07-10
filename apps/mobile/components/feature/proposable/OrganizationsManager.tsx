import { useState } from 'react';
import {
  requestOrganization, newOrganizationId, approveOrganization,
} from '@cultuvilla/shared/services/organizationService';
import { uploadOrganizationImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import {
  PROPOSABLE_ORGANIZATION_TYPES,
  type OrganizationType,
} from '@cultuvilla/shared/models/organization/OrganizationDataModel';
import { VStack } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { ProposableForm } from './ProposableForm';

/**
 * "Añadir agrupación" form. A villager proposes a peña/asociación/otros
 * (pending); an organizer proposes-then-auto-approves. Calls `onCreated` after
 * submit. Editing/deleting an org lives on the org's own edit screen, not here.
 */
export function OrganizationsManager({
  villageId,
  initialType = 'peña',
  onCreated,
}: {
  villageId: string;
  /** Preselects the type picker when opened from the add-content sheet. */
  initialType?: OrganizationType;
  onCreated?: () => void;
}) {
  const { t } = useT();
  const { canManage, uid } = useEntityCapabilities(villageId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OrganizationType>(initialType);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [saving, setSaving] = useState(false);

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
      if (canManage) await approveOrganization(id);
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
