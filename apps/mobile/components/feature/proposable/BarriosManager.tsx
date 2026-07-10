import { useState } from 'react';
import {
  createBarrio, proposeBarrio, updateBarrio,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadBarrioImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { VStack } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { ProposableForm } from './ProposableForm';

/**
 * "Añadir barrio" form. A villager proposes (pending); an organizer creates
 * directly. Calls `onCreated` after submit. Editing/deleting a barrio lives on
 * the barrio's own edit screen, not here.
 */
export function BarriosManager({
  villageId,
  onCreated,
}: {
  villageId: string;
  onCreated?: () => void;
}) {
  const { t } = useT();
  const { canManage, uid } = useEntityCapabilities(villageId);
  const [name, setName] = useState('');
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [saving, setSaving] = useState(false);

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

  return (
    <VStack gap={3} className="p-4">
      <ProposableForm
        image={image}
        onImageChange={setImage}
        imageLabels={{
          add: t('village.admin.barrios.addImage'),
          selected: t('village.admin.barrios.imageSelected'),
        }}
        name={name}
        onChangeName={setName}
        nameLabel={t('village.admin.barrios.name')}
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
