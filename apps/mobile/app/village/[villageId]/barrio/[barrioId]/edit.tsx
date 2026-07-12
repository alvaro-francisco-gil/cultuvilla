import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, Redirect, router } from 'expo-router';
import { Screen } from '../../../../../components/primitives/Screen';
import { Text } from '../../../../../components/primitives/Text';
import { ScreenHeader } from '../../../../../components/layout/ScreenHeader';
import { ProposableForm } from '../../../../../components/feature/proposable/ProposableForm';
import { DeleteHeaderButton } from '../../../../../components/feature/DeleteHeaderButton';
import { useT } from '../../../../../lib/i18n';
import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';
import { getBarrio, updateBarrio } from '@cultuvilla/shared/services/municipalityService';
import { hideContent } from '@cultuvilla/shared/services/moderationService';
import { uploadBarrioImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';

export default function BarrioEditScreen() {
  const { villageId, barrioId } = useLocalSearchParams<{ villageId: string; barrioId: string }>();
  const { t } = useT();
  const { canManage, loading: capLoading } = useEntityCapabilities(villageId);
  const [name, setName] = useState('');
  const [existingImageUri, setExistingImageUri] = useState<string | null>(null);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!villageId || !barrioId) return;
    void (async () => {
      const b = await getBarrio(villageId, barrioId);
      if (b) {
        setName(b.name);
        setExistingImageUri(b.imageURL ?? null);
      } else {
        setNotFound(true);
      }
      setLoaded(true);
    })();
  }, [villageId, barrioId]);

  if (capLoading) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('village.admin.barrios.editTitle')} />
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      </Screen>
    );
  }
  if (!canManage) return <Redirect href={`/village/${villageId}/barrio/${barrioId}`} />;

  async function submit() {
    if (!villageId || !barrioId || !name.trim()) return;
    setSaving(true);
    try {
      await updateBarrio(villageId, barrioId, { name: name.trim() });
      if (image) {
        const imageURL = await uploadBarrioImage(villageId, barrioId, image);
        await updateBarrio(villageId, barrioId, { imageURL });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false} topInset={false}>
      <ScreenHeader
        accent
        title={t('village.admin.barrios.editTitle')}
        rightSlot={
          <DeleteHeaderButton
            onAccent
            onConfirm={() => {
              if (villageId && barrioId)
                return hideContent({ collection: 'barrios', docId: barrioId, municipalityId: villageId })
                  .then(() => router.replace(`/village/${villageId}`));
            }}
            accessibilityLabel={t('common.delete')}
            confirmTitle={t('common.deleteConfirmTitle')}
            confirmMessage={t('common.deleteConfirmMessage')}
            confirmLabel={t('common.delete')}
            cancelLabel={t('common.cancel')}
            deletingLabel={t('common.deleting.barrio')}
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
            image={image}
            onImageChange={setImage}
            existingImageUri={existingImageUri}
            imageLabels={{
              add: t('village.admin.barrios.addImage'),
              selected: t('village.admin.barrios.imageSelected'),
            }}
            name={name}
            onChangeName={setName}
            nameLabel={t('village.admin.barrios.name')}
            nameTestID="barrio-edit-name-input"
            submitLabel={t('common.save')}
            submitTestID="barrio-edit-submit"
            onSubmit={submit}
            saving={saving}
            disabled={!name.trim()}
          />
        </ScrollView>
      )}
    </Screen>
  );
}
