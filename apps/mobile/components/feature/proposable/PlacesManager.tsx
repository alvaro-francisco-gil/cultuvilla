import { useState } from 'react';
import {
  createPlace, newPlaceId,
} from '@cultuvilla/shared/services/municipalityService';
import { deleteImageByURL, uploadPlaceImage } from '@cultuvilla/shared/services/imageService';
import { PLACE_KINDS, type PlaceKind } from '@cultuvilla/shared/models/municipality';
import { VStack } from '../../primitives';
import { pickImageAsBlob } from '../../../lib/images';
import { useT } from '../../../lib/i18n';
import { useEntityCapabilities } from '../../../lib/auth/useEntityCapabilities';
import { ProposableForm } from './ProposableForm';
import { OrganizerPicker } from '../OrganizerPicker';

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

  // Mint the id up front so each picked image can upload before the doc write.
  const [placeId] = useState(() => newPlaceId(villageId));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<PlaceKind>('cemetery');
  const [images, setImages] = useState<string[]>([]);
  const [addingImage, setAddingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contributorUserIds, setContributorUserIds] = useState<string[]>([]);
  const [contributorOrgIds, setContributorOrgIds] = useState<string[]>([]);

  const kindLabel = (k: PlaceKind) => t(`village.admin.places.kind.${k}`);

  async function addImage() {
    if (!villageId) return;
    const picked = await pickImageAsBlob();
    if (!picked) return;
    setAddingImage(true);
    try {
      const url = await uploadPlaceImage(villageId, placeId, picked);
      setImages((prev) => [...prev, url]);
    } finally {
      setAddingImage(false);
    }
  }

  function removeImage(index: number) {
    const url = images[index];
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (url) void deleteImageByURL(url).catch(() => {}); // best-effort orphan cleanup
  }

  async function submit() {
    if (!villageId || !name.trim() || !uid) return;
    setSaving(true);
    try {
      const input = {
        name: name.trim(), kind, description: description.trim(),
        municipalityId: villageId, proposedBy: uid, images,
        contributorUserIds: contributorUserIds.includes(uid) ? contributorUserIds : [uid, ...contributorUserIds],
        contributorOrgIds,
      };
      await createPlace(villageId, input, placeId);
      setName('');
      setDescription('');
      setKind('cemetery');
      setImages([]);
      setContributorUserIds([]);
      setContributorOrgIds([]);
      onCreated?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <VStack gap={3} className="p-4">
      {uid ? (
        <OrganizerPicker
          municipalityId={villageId}
          selectedUserIds={contributorUserIds.includes(uid) ? contributorUserIds : [uid, ...contributorUserIds]}
          selectedOrgIds={contributorOrgIds}
          lockedUserId={uid}
          onChangeUsers={setContributorUserIds}
          onChangeOrgs={setContributorOrgIds}
          peopleLabel={t('village.contributors.peopleLabel')}
          addPersonLabel={t('village.contributors.addPerson')}
          selectPeopleTitle={t('village.contributors.selectPeople')}
        />
      ) : null}
      <ProposableForm
        images={images}
        onAddImage={addImage}
        onRemoveImage={removeImage}
        addingImage={addingImage}
        imageLabels={{
          add: t('village.admin.places.addImage'),
          remove: t('village.admin.places.removeImage'),
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
