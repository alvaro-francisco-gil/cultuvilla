import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useLocalSearchParams, Redirect, router } from 'expo-router';
import { Screen } from '../../../../../components/primitives/Screen';
import { Text } from '../../../../../components/primitives/Text';
import { VStack } from '../../../../../components/primitives/VStack';
import { Input } from '../../../../../components/primitives/Input';
import { Button } from '../../../../../components/primitives/Button';
import { FieldLabel } from '../../../../../components/primitives/FieldLabel';
import { DateField } from '../../../../../components/primitives/DateField';
import { ImagePickerField } from '../../../../../components/primitives/ImagePickerField';
import { ScreenHeader } from '../../../../../components/layout/ScreenHeader';
import { DeleteHeaderButton } from '../../../../../components/feature/DeleteHeaderButton';
import { sanitizeYear, datesToPayload } from '../../../../../components/feature/proposable/festivalPosterForm';
import { useT } from '../../../../../lib/i18n';
import { useEntityCapabilities } from '../../../../../lib/auth/useEntityCapabilities';
import { pickImageAsBlob } from '../../../../../lib/images';
import {
  getFestivalPoster,
  updateFestivalPoster,
} from '@cultuvilla/shared/services/festivalPosterService';
import { hideContent } from '@cultuvilla/shared/services/moderationService';
import { uploadFestivalPosterImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';

export default function FestivalPosterEditScreen() {
  const { villageId, posterId } = useLocalSearchParams<{ villageId: string; posterId: string }>();
  const { t } = useT();
  const { canManage, loading: capLoading } = useEntityCapabilities(villageId);

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [endsAt, setEndsAt] = useState<Date | null>(null);
  const [existingImageUri, setExistingImageUri] = useState<string | null>(null);
  const [image, setImage] = useState<UploadableImage | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!posterId) return;
    void (async () => {
      const p = await getFestivalPoster(posterId);
      if (p) {
        setYear(String(p.year));
        setTitle(p.title ?? '');
        setStartsAt(p.startsAt);
        setEndsAt(p.endsAt);
        setExistingImageUri(p.imageURL ?? null);
      } else {
        setNotFound(true);
      }
      setLoaded(true);
    })();
  }, [posterId]);

  if (capLoading) {
    return (
      <Screen padded={false} topInset={false}>
        <ScreenHeader accent title={t('village.festivalPosters.editTitle')} />
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      </Screen>
    );
  }
  if (!canManage) return <Redirect href={`/village/${villageId}/festival-poster/${posterId}`} />;

  const yearNum = parseInt(year, 10);

  async function submit() {
    if (!posterId || !villageId || !Number.isInteger(yearNum)) return;
    setSaving(true);
    try {
      await updateFestivalPoster(posterId, {
        year: yearNum,
        title: title.trim() || null,
        ...datesToPayload(startsAt, endsAt),
      });
      if (image) {
        const imageURL = await uploadFestivalPosterImage(villageId, posterId, image);
        await updateFestivalPoster(posterId, { imageURL });
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
        title={t('village.festivalPosters.editTitle')}
        rightSlot={
          <DeleteHeaderButton
            onAccent
            onConfirm={() => {
              if (posterId)
                void hideContent({ collection: 'festivalPosters', docId: posterId })
                  .then(() => router.replace(`/village/${villageId}`));
            }}
            accessibilityLabel={t('common.delete')}
            confirmTitle={t('common.deleteConfirmTitle')}
            confirmMessage={t('common.deleteConfirmMessage')}
            confirmLabel={t('common.delete')}
            cancelLabel={t('common.cancel')}
          />
        }
      />
      {!loaded ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
      ) : notFound ? (
        <View className="flex-1 items-center justify-center"><Text>{t('common.notFound')}</Text></View>
      ) : (
        <ScrollView contentContainerClassName="p-4">
          <VStack gap={3} align="start">
            <VStack gap={1} align="start">
              <FieldLabel>{t('village.festivalPosters.form.image')}</FieldLabel>
              <ImagePickerField
                uri={image?.previewUri ?? existingImageUri}
                onPress={async () => {
                  const picked = await pickImageAsBlob();
                  if (picked) setImage(picked);
                }}
                label={t('village.festivalPosters.form.image')}
              />
            </VStack>
            <Input
              testID="poster-edit-year-input"
              value={year}
              onChangeText={(txt) => setYear(sanitizeYear(txt))}
              label={t('village.festivalPosters.form.year')}
              keyboardType="number-pad"
            />
            <Input
              testID="poster-edit-title-input"
              value={title}
              onChangeText={setTitle}
              label={t('village.festivalPosters.form.title')}
              placeholder={t('village.festivalPosters.form.titlePlaceholder')}
            />
            <DateField
              label={t('village.festivalPosters.form.startDate')}
              value={startsAt}
              onChange={setStartsAt}
            />
            <DateField
              label={t('village.festivalPosters.form.endDate')}
              value={endsAt}
              onChange={setEndsAt}
            />
            <Button
              testID="poster-edit-submit"
              onPress={submit}
              loading={saving}
              disabled={!Number.isInteger(yearNum)}
              fullWidth
            >
              {t('common.save')}
            </Button>
          </VStack>
        </ScrollView>
      )}
    </Screen>
  );
}
