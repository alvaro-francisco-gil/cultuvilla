import { useState } from 'react';
import {
  createPlace, updatePlace,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadPlaceImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { PLACE_KINDS, type PlaceKind } from '@cultuvilla/shared/models/municipality';
import { VStack } from '../../primitives';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { ProposableForm } from './ProposableForm';

/**
 * "Añadir lugar" form. Any member creates directly and the place is visible
 * immediately (optimistic); admins hide bad content afterwards from the place's
 * edit screen. Calls `onCreated` after submit. Editing/deleting lives on the
 * place's own edit screen, not here.
 */
export function PlacesManager({
  villageId,
  onCreated,
}: {
  villageId: string;
  onCreated?: () => void;
}) {
  const { t } = useT();
  const { uid } = useEntityCapabilities(villageId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<PlaceKind>('cemetery');
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [saving, setSaving] = useState(false);

  const kindLabel = (k: PlaceKind) => t(`village.admin.places.kind.${k}`);

  async function submit() {
    if (!villageId || !name.trim() || !uid) return;
    setSaving(true);
    try {
      const input = {
        name: name.trim(), kind, description: description.trim(),
        municipalityId: villageId, proposedBy: uid,
      };
      const id = await createPlace(villageId, input);
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
        submitLabel={t('village.admin.places.add')}
        submitTestID="place-submit"
        onSubmit={submit}
        saving={saving}
        disabled={!name.trim()}
      />
    </VStack>
  );
}
