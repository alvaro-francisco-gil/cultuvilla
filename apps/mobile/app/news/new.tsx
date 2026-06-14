import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Screen, VStack, Text, Input, Button } from '../../components/primitives';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { useAuth } from '../../lib/auth/useAuth';
import { useT } from '../../lib/i18n';
import { useCallable } from '../../lib/useCallable';
import { createNewsPost, updateNewsPost } from '@cultuvilla/shared/services/newsService';
import { uploadNewsImage } from '@cultuvilla/shared/services/imageService';
import {
  NEWS_POST_CATEGORIES,
  type NewsPostCategory,
  type NewsPostImage,
} from '@cultuvilla/shared/models/news/NewsPostDataModel';

type PickedImage = { uri: string; blob: Blob; width: number; height: number };

async function pickImage(): Promise<PickedImage | null> {
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
  return { uri: asset.uri, blob, width: asset.width, height: asset.height };
}

export default function NewNewsScreen() {
  const { user, profile } = useAuth();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const municipalityId = profile?.activeMunicipalityId ?? null;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<NewsPostCategory | null>(null);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    !!municipalityId && !!user && title.trim().length > 0 && body.trim().length > 0 && !!category;

  const { fire: submit, isPending } = useCallable({
    callable: async () => {
      if (!municipalityId || !user || !category) return;
      const postId = await createNewsPost({
        municipalityId,
        authorUserId: user.uid,
        title: title.trim(),
        body: body.trim(),
        category,
      });
      if (images.length > 0) {
        const uploaded: NewsPostImage[] = [];
        for (const [i, img] of images.entries()) {
          const storagePath = await uploadNewsImage(postId, {
            blob: img.blob,
            filename: `news-${i}.jpg`,
            contentType: img.blob.type || 'image/jpeg',
          });
          uploaded.push({ storagePath, width: img.width, height: img.height });
        }
        await updateNewsPost(postId, { images: uploaded });
      }
      return postId;
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    swallow: true,
  });

  if (!municipalityId) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('news.compose.title')} />
        <View className="flex-1 items-center justify-center px-8">
          <Text tone="muted" className="text-center">
            {t('news.compose.needsMembership')}
          </Text>
        </View>
      </Screen>
    );
  }

  if (submitted) {
    return (
      <Screen padded={false}>
        <ScreenHeader title={t('news.compose.title')} />
        <View className="flex-1 items-center justify-center px-8">
          <VStack gap={4} className="items-center">
            <Ionicons name="checkmark-circle-outline" size={48} color="#16a34a" />
            <Text className="text-center">{t('news.compose.successPending')}</Text>
            <Button onPress={() => router.back()}>{t('common.back')}</Button>
          </VStack>
        </View>
      </Screen>
    );
  }

  // bottomInset={false}: the ScrollView below applies insets.bottom itself.
  return (
    <Screen padded={false} bottomInset={false}>
      <ScreenHeader title={t('news.compose.title')} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 80 }}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label={t('news.compose.titleLabel')}
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label={t('news.compose.bodyLabel')}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
          />
          <Text tone="muted">{t('news.compose.categoryLabel')}</Text>
          <VStack gap={2}>
            {NEWS_POST_CATEGORIES.map((opt) => (
              <Button
                key={opt}
                variant={category === opt ? 'primary' : 'secondary'}
                onPress={() => setCategory(category === opt ? null : opt)}
              >
                {t(`news.compose.category.${opt}`)}
              </Button>
            ))}
          </VStack>
          <Text tone="muted">{t('news.compose.imagesLabel')}</Text>
          {images.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {images.map((img, i) => (
                <Pressable
                  key={img.uri}
                  onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  accessibilityLabel={`${t('news.compose.imagesLabel')} ${i + 1}`}
                >
                  <Image
                    source={{ uri: img.uri }}
                    style={{ width: 80, height: 80, borderRadius: 8 }}
                    accessibilityIgnoresInvertColors
                  />
                </Pressable>
              ))}
            </View>
          )}
          <Button
            variant="secondary"
            onPress={async () => {
              const next = await pickImage();
              if (next) setImages((prev) => [...prev, next]);
            }}
          >
            {t('news.compose.addImage')}
          </Button>
          <Button
            onPress={() => void submit()}
            loading={isPending}
            disabled={!canSubmit}
            fullWidth
          >
            {t('news.compose.submit')}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
