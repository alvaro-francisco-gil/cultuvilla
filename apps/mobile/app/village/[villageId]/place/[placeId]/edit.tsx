import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, Redirect, router } from 'expo-router';
import { Screen } from '../../../../../components/primitives/Screen';
import { Text } from '../../../../../components/primitives/Text';
import { ScreenHeader } from '../../../../../components/layout/ScreenHeader';
import { ProposableForm } from '../../../../../components/feature/proposable/ProposableForm';
import { useT } from '../../../../../lib/i18n';
import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';
import { getPlace, updatePlace } from '@cultuvilla/shared/services/municipalityService';
import { uploadPlaceImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';
import { PLACE_KINDS, type PlaceKind } from '@cultuvilla/shared/models/municipality';

export default function PlaceEditScreen() {
  const { villageId, placeId } = useLocalSearchParams<{ villageId: string; placeId: string }>();
  const { t } = useT();
  const { canManage, loading: capLoading } = useEntityCapabilities(villageId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<PlaceKind>('cemetery');
  const [existingImageUri, setExistingImageUri] = useState<string | null>(null);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const kindLabel = (k: PlaceKind) => t(`village.admin.places.kind.${k}` as never);

  useEffect(() => {
    if (!villageId || !placeId) return;
    void (async () => {
      const p = await getPlace(villageId, placeId);
      if (p) {
        setName(p.name);
        setDescription(p.description ?? '');
        setKind(p.kind);
        setExistingImageUri(p.imageURL ?? null);
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

  async function submit() {
    if (!villageId || !placeId || !name.trim()) return;
    setSaving(true);
    try {
      await updatePlace(villageId, placeId, {
        name: name.trim(), kind, description: description.trim(),
      });
      if (image) {
        const imageURL = await uploadPlaceImage(villageId, placeId, image);
        await updatePlace(villageId, placeId, { imageURL });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader accent title={t('village.admin.places.editTitle')} />
      {!loaded ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center"><Text>{t('common.notFound')}</Text></View>
      ) : (
        <ScrollView contentContainerClassName="p-4">
          <ProposableForm
            image={image}
            onImageChange={setImage}
            existingImageUri={existingImageUri}
            imageLabels={{
              add: t('village.admin.places.addImage'),
              selected: t('village.admin.places.imageSelected'),
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
        </ScrollView>
      )}
    </Screen>
  );
}
