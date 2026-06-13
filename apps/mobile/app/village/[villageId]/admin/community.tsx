import { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, VStack, HStack, Text, Button, Input, Pressable } from '../../../../components/primitives';
import { ScreenHeader } from '../../../../components/layout/ScreenHeader';
import { useT } from '../../../../lib/i18n';
import { pickImageAsBlob } from '../../../../lib/images';
import {
  getMunicipality,
  updateCommunity,
} from '@cultuvilla/shared/services/municipalityService';
import { uploadMunicipalityImage } from '@cultuvilla/shared/services/imageService';

const ACCENT = '#bb5d3a';

export default function CommunitySettingsScreen() {
  const { villageId } = useLocalSearchParams<{ villageId: string }>();
  const { t } = useT();
  const [description, setDescription] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!villageId) return;
    getMunicipality(villageId).then((m) => {
      setDescription(m?.community?.description ?? '');
      setImages(m?.community?.coverImages ?? []);
    });
  }, [villageId]);

  async function addImage() {
    if (!villageId) return;
    const picked = await pickImageAsBlob();
    if (!picked) return;
    setUploading(true);
    try {
      const url = await uploadMunicipalityImage(villageId, picked);
      setImages((prev) => [...prev, url]);
    } catch (e) {
      // mobile-web-compat: native-only — admin surface, not exercised on web
      Alert.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  async function save() {
    if (!villageId || description === null) return;
    setSaving(true);
    try {
      await updateCommunity(villageId, { description, coverImages: images });
      // mobile-web-compat: native-only — admin surface, not exercised on web
      Alert.alert(t('village.admin.community.saved'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('village.admin.community.title')} />
      <ScrollView contentContainerClassName="p-4">
        <VStack gap={3}>
          <Text variant="h3">{t('village.admin.community.images')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
            {images.map((url) => (
              <View key={url} className="relative">
                <Image source={{ uri: url }} className="w-40 h-28 rounded-xl" resizeMode="cover" />
                <Pressable
                  onPress={() => removeImage(url)}
                  accessibilityLabel={t('common.delete')}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={addImage}
              accessibilityLabel={t('village.admin.community.addImage')}
              className="w-40 h-28 border border-dashed border-subtle rounded-xl items-center justify-center"
            >
              <Ionicons name={uploading ? 'cloud-upload-outline' : 'add'} size={28} color={ACCENT} />
              <Text variant="bodySm" className="mt-1 font-medium">
                {t('village.admin.community.addImage')}
              </Text>
            </Pressable>
          </ScrollView>

          <Text variant="h3" className="mt-2">{t('village.admin.community.description')}</Text>
          <Input
            value={description ?? ''}
            onChangeText={setDescription}
            multiline
            placeholder={t('village.admin.community.description')}
          />

          <Button onPress={save} loading={saving} disabled={uploading}>
            {t('common.save')}
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
}
