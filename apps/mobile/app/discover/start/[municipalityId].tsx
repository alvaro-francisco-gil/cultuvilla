import { useState } from 'react';
import { Image, ScrollView, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen, VStack, HStack, Text, Input, Button, Pressable } from '../../../components/primitives';
import { ScreenHeader } from '../../../components/layout/ScreenHeader';
import { useT } from '../../../lib/i18n';
import { useCallable } from '../../../lib/useCallable';
import { startVillage } from '@cultuvilla/shared/services/municipalityService';
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

/**
 * "Start this village" — self-service activation of a dormant municipality.
 * Activating it makes the village joinable and adds the starter as its first
 * member; it does NOT make them the organizer. The optional toggle files an
 * organizer request in the same flow (still superadmin-approved).
 */
export default function StartVillageScreen() {
  const { municipalityId } = useLocalSearchParams<{ municipalityId: string }>();
  const { t } = useT();
  const [description, setDescription] = useState('');
  const [covers, setCovers] = useState<PickedCover[]>([]);
  const [wantOrganize, setWantOrganize] = useState(false);
  const [motivation, setMotivation] = useState('');

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      const id = municipalityId ?? '';
      // Upload on submit so nothing lands in Storage unless the village starts.
      const coverImages = await Promise.all(covers.map((c) => uploadVillageCoverImage(id, c.image)));
      await startVillage({ municipalityId: id, description: description.trim(), coverImages });
      if (wantOrganize) {
        await requestOrganizeVillage({ municipalityId: id, motivation: motivation.trim() || null });
      }
    },
    onSuccess: () => {
      router.replace({
        pathname: '/village/[villageId]',
        params: { villageId: municipalityId ?? '' },
      });
    },
    swallow: true,
  });

  return (
    <Screen padded={false}>
      <ScreenHeader title={t('start.title')} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <VStack gap={4}>
          <Text tone="muted" variant="bodySm">
            {t('start.explainer')}
          </Text>

          <Input
            label={t('start.descriptionLabel')}
            placeholder={t('start.descriptionPlaceholder')}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />

          <VStack gap={2}>
            <Text variant="caption" tone="muted">
              {t('start.coversLabel')}
            </Text>
            {covers.length > 0 && (
              <HStack gap={2} className="flex-wrap">
                {covers.map((c) => (
                  <Pressable
                    key={c.uri}
                    onPress={() => setCovers((prev) => prev.filter((p) => p.uri !== c.uri))}
                  >
                    <Image source={{ uri: c.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />
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
              {t('start.addCover')}
            </Button>
          </VStack>

          <HStack gap={3} className="items-center justify-between">
            <VStack gap={1} className="flex-1">
              <Text>{t('start.organizeToggle')}</Text>
              <Text tone="muted" variant="bodySm">
                {t('start.organizeHint')}
              </Text>
            </VStack>
            <Switch value={wantOrganize} onValueChange={setWantOrganize} />
          </HStack>

          {wantOrganize && (
            <Input
              label={t('requests.organizer.motivationLabel')}
              value={motivation}
              onChangeText={setMotivation}
              multiline
              numberOfLines={4}
            />
          )}

          <Button
            onPress={() => {
              if (!municipalityId) return;
              void submit();
            }}
            loading={isPending}
            disabled={!municipalityId}
            fullWidth
          >
            <Text tone="onAccent">{t('start.submit')}</Text>
          </Button>
        </VStack>
      </ScrollView>
    </Screen>
  );
}
