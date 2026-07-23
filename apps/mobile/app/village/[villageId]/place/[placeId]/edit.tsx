import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, Redirect, router } from 'expo-router';
import { Screen } from '../../../../../components/primitives/Screen';
import { Text } from '../../../../../components/primitives/Text';
import { ScreenHeader } from '../../../../../components/layout/ScreenHeader';
import { ProposableForm } from '../../../../../components/feature/proposable/ProposableForm';
import { OrganizerPicker } from '../../../../../components/feature/OrganizerPicker';
import { DeleteHeaderButton } from '../../../../../components/feature/DeleteHeaderButton';
import { useT } from '../../../../../lib/i18n';
import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';
import { pickImageAsBlob } from '../../../../../lib/images';
import { getPlace, updatePlace } from '@cultuvilla/shared/services/municipalityService';
import { hideContent } from '@cultuvilla/shared/services/moderationService';
import { deleteImageByURL, uploadPlaceImage } from '@cultuvilla/shared/services/imageService';
import { PLACE_KINDS, type PlaceKind } from '@cultuvilla/shared/models/municipality';

export default function PlaceEditScreen() {
  const { villageId, placeId } = useLocalSearchParams<{ villageId: string; placeId: string }>();
  const { t } = useT();
  const { canManage, uid, loading: capLoading } = useEntityCapabilities(villageId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<PlaceKind>('cemetery');
  const [images, setImages] = useState<string[]>([]);
  const [addingImage, setAddingImage] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contributorUserIds, setContributorUserIds] = useState<string[]>([]);
  const [contributorOrgIds, setContributorOrgIds] = useState<string[]>([]);

  const kindLabel = (k: PlaceKind) => t(`village.admin.places.kind.${k}` as never);

  useEffect(() => {
    if (!villageId || !placeId) return;
    void (async () => {
      const p = await getPlace(villageId, placeId);
      if (p) {
        setName(p.name);
        setDescription(p.description ?? '');
        setKind(p.kind);
        setImages(p.images);
        setContributorUserIds(p.contributorUserIds);
        setContributorOrgIds(p.contributorOrgIds);
      } else {
        setNotFound(true);
      }
      setLoaded(true);
    })();
  }, [villageId, placeId]);

  if (capLoading) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('village.admin.places.editTitle')} />
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      </Screen>
    );
  }
  if (!canManage) return <Redirect href={`/village/${villageId}/place/${placeId}`} />;

  // Images persist immediately (unlike the create flow, the doc already
  // exists here), so add/remove writes the doc on each action rather than
  // batching to submit.
  async function addImage() {
    if (!villageId || !placeId) return;
    const picked = await pickImageAsBlob();
    if (!picked) return;
    setAddingImage(true);
    try {
      const url = await uploadPlaceImage(villageId, placeId, picked);
      const next = [...images, url];
      await updatePlace(villageId, placeId, { images: next });
      setImages(next);
    } finally {
      setAddingImage(false);
    }
  }

  async function removeImage(index: number) {
    if (!villageId || !placeId) return;
    const url = images[index];
    const next = images.filter((_, i) => i !== index);
    await updatePlace(villageId, placeId, { images: next });
    setImages(next);
    if (url) void deleteImageByURL(url).catch(() => {}); // best-effort orphan cleanup
  }

  async function submit() {
    if (!villageId || !placeId || !name.trim()) return;
    setSaving(true);
    try {
      await updatePlace(villageId, placeId, {
        name: name.trim(), kind, description: description.trim() || null,
        contributorUserIds, contributorOrgIds,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader
        accent
        title={t('village.admin.places.editTitle')}
        rightSlot={
          <DeleteHeaderButton
            onAccent
            onConfirm={() => {
              if (villageId && placeId)
                return hideContent({ collection: 'places', docId: placeId, municipalityId: villageId })
                  .then(() => router.replace(`/village/${villageId}`));
            }}
            accessibilityLabel={t('common.delete')}
            confirmTitle={t('common.deleteConfirmTitle')}
            confirmMessage={t('common.deleteConfirmMessage')}
            confirmLabel={t('common.delete')}
            cancelLabel={t('common.cancel')}
            deletingLabel={t('common.deleting.place')}
            testID="place-delete"
          />
        }
      />
      {!loaded ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center"><Text>{t('common.notFound')}</Text></View>
      ) : (
        <ScrollView contentContainerClassName="p-4">
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
            nameTestID="place-edit-name-input"
            description={description}
            onChangeDescription={setDescription}
            descriptionLabel={t('village.admin.places.description')}
            typeLabel={t('village.admin.places.kindLabel')}
            typeOptions={PLACE_KINDS.map((k) => ({ value: k, label: kindLabel(k) }))}
            typeValue={kind}
            onChangeType={(v) => setKind(v as PlaceKind)}
            submitLabel={t('common.save')}
            submitTestID="place-edit-submit"
            onSubmit={submit}
            saving={saving}
            disabled={!name.trim()}
          />
          {uid ? (
            <OrganizerPicker
              municipalityId={villageId}
              selectedUserIds={contributorUserIds}
              selectedOrgIds={contributorOrgIds}
              onChangeUsers={setContributorUserIds}
              onChangeOrgs={setContributorOrgIds}
              peopleLabel={t('village.contributors.peopleLabel')}
              addPersonLabel={t('village.contributors.addPerson')}
              selectPeopleTitle={t('village.contributors.selectPeople')}
            />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}
