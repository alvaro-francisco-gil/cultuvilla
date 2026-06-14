import { useState } from 'react';
import { Image, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen, VStack, HStack, Text, Input, Button, Pressable } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useCallable } from '../../../lib/useCallable';
import { requestOrganizeVillage } from '@cultuvilla/shared/services/organizerRequestService';
import { uploadVillageCoverImage } from '@cultuvilla/shared/services/imageService';
import type { UploadableImage } from '@cultuvilla/shared/services/imageService';

interface PickedCover {
  uri: string;
  image: UploadableImage;
}

async function pickCover(): Promise<PickedCover | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (res.canceled || !res.assets[0]) return null;
  const asset = res.assets[0];
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const filename = asset.fileName ?? `cover-${asset.assetId ?? 'image'}.jpg`;
  const contentType = asset.mimeType ?? 'image/jpeg';
  return { uri: asset.uri, image: { blob, filename, contentType } };
}

export default function RequestOrganizerScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const [description, setDescription] = useState('');
  const [motivation, setMotivation] = useState('');
  const [covers, setCovers] = useState<PickedCover[]>([]);

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      const id = municipalityId ?? '';
      // Upload on submit so nothing lands in Storage unless a request is created.
      const coverImages = await Promise.all(
        covers.map((c) => uploadVillageCoverImage(id, c.image)),
      );
      await requestOrganizeVillage({
        municipalityId: id,
        description: description.trim(),
        coverImages,
        motivation: motivation.trim() || null,
      });
    },
    onSuccess: () => {
      router.back();
    },
    swallow: true,
  });

  const canSubmit = !!municipalityId && description.trim().length > 0;

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('requests.organizer.title')} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <VStack gap={4}>
          <Input
            label={t('requests.organizer.descriptionLabel')}
            placeholder={t('requests.organizer.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <VStack gap={2}>
            <Text variant="caption" tone="muted">
              {t('requests.organizer.coversLabel')}
            </Text>
            {covers.length > 0 && (
              <HStack gap={2} className="flex-wrap">
                {covers.map((c) => (
                  <Pressable
                    key={c.uri}
                    onPress={() => setCovers((prev) => prev.filter((p) => p.uri !== c.uri))}
                  >
                    <Image
                      source={{ uri: c.uri }}
                      style={{ width: 72, height: 72, borderRadius: 8 }}
                    />
                  </Pressable>
                ))}
              </HStack>
            )}
            <Button
              variant="ghost"
              onPress={async () => {
                const next = await pickCover();
                if (next) setCovers((prev) => [...prev, next]);
              }}
            >
              {t('requests.organizer.addCover')}
            </Button>
          </VStack>

          <Input
            label={t('requests.organizer.motivationLabel')}
            value={motivation}
            onChangeText={setMotivation}
            multiline
            numberOfLines={4}
          />

          <Button
            onPress={() => {
              if (!canSubmit) return;
              void submit();
            }}
            loading={isPending}
            disabled={!canSubmit}
            fullWidth
          >
            <Text tone="onAccent">{t('requests.organizer.submit')}</Text>
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
}
