import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, VStack, Text, Input, Button, Pressable } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { pickImageAsBlob } from '../../../lib/images';
import { getMunicipality, updateVillageInfo } from '@cultuvilla/shared/services/municipalityService';
import { uploadMunicipalityImage } from '@cultuvilla/shared/services/imageService';

const ACCENT = '#bb5d3a';

/**
 * Edit a village's basic info (description + cover images). Reachable by any
 * member while the village has no organizer (wiki phase), and by admins after.
 * The write goes through the `updateVillageInfo` callable, which enforces that
 * authorization server-side.
 */
export default function EditVillageInfoScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [description, setDescription] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!villageId) return;
    const m = await getMunicipality(villageId);
    setDescription(m?.community?.description ?? '');
    setImages(m?.community?.coverImages ?? []);
  }, [villageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addImage() {
    if (!villageId) return;
    const picked = await pickImageAsBlob();
    if (!picked) return;
    setUploading(true);
    try {
      const url = await uploadMunicipalityImage(villageId, picked);
      setImages((prev) => [...prev, url]);
    } catch (e) {
      // mobile-web-compat: native-only — guarded image-upload error toast
      if (Platform.OS !== 'web') Alert.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!villageId || description === null) return;
    setSaving(true);
    try {
      await updateVillageInfo({ municipalityId: villageId, description, coverImages: images });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (description === null) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('editInfo.title')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('editInfo.title')} />
      <ScrollView contentContainerClassName="p-4">
        <VStack gap={3}>
          <Text variant="h3">{t('editInfo.imagesLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
            {images.map((url) => (
              <View key={url} className="relative">
                <Image source={{ uri: url }} className="w-40 h-28 rounded-xl" resizeMode="cover" />
                <Pressable
                  onPress={() => setImages((prev) => prev.filter((u) => u !== url))}
                  accessibilityLabel={t('common.delete')}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={addImage}
              accessibilityLabel={t('editInfo.addImage')}
              className="w-40 h-28 border border-dashed border-subtle rounded-xl items-center justify-center"
            >
              <Ionicons name={uploading ? 'cloud-upload-outline' : 'add'} size={28} color={ACCENT} />
              <Text variant="bodySm" className="mt-1 font-medium">
                {t('editInfo.addImage')}
              </Text>
            </Pressable>
          </ScrollView>

          <Text variant="h3" className="mt-2">
            {t('editInfo.descriptionLabel')}
          </Text>
          <Input value={description} onChangeText={setDescription} multiline />

          <Button onPress={save} loading={saving} disabled={uploading}>
            {t('common.save')}
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
}
