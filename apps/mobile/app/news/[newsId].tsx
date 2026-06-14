import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { HStack } from '../../components/primitives/HStack';
import { DetailHeroImage } from '../../components/feature/DetailHeroImage';
import { useT } from '../../lib/i18n';
import { getNewsPost } from '@cultuvilla/shared/services/newsService';
import { getMunicipality } from '@cultuvilla/shared/services/municipalityService';
import { newsImageDownloadURL } from '@cultuvilla/shared/services/imageService';
import { formatDate } from '@cultuvilla/shared/utils';
import type { NewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';

type Post = NewsPostData & { id: string };

export default function NewsDetailScreen() {
  const { newsId } = useLocalSearchParams<{ newsId: string }>();
  const { t } = useT();
  const [post, setPost] = useState<Post | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [villageCover, setVillageCover] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!newsId) return;
    getNewsPost(newsId as string)
      .then((p) => setPost(p))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [newsId]);

  // Resolve the first image (if any) to a download URL.
  const firstImagePath = post?.images[0]?.storagePath ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!firstImagePath) {
      setImageUrl(null);
      return;
    }
    newsImageDownloadURL(firstImagePath)
      .then((url) => {
        if (!cancelled) setImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [firstImagePath]);

  // Fetch the village cover photo as a fallback when the post has no image.
  const municipalityId = post?.municipalityId ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!municipalityId) {
      setVillageCover(null);
      return;
    }
    getMunicipality(municipalityId)
      .then((m) => {
        if (!cancelled) setVillageCover(m?.community?.coverImages?.[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setVillageCover(null);
      });
    return () => {
      cancelled = true;
    };
  }, [municipalityId]);

  const date = post ? (post.publishedAt ?? post.submittedAt) : null;

  return (
    <Screen padded={false}>
      <AppHeader centerLabel={post?.title ?? 'Noticia'} />
      <ScrollView>
        {loading ? (
          <VStack className="p-4">
            <ActivityIndicator />
          </VStack>
        ) : null}
        {error ? (
          <VStack className="p-4">
            <Text tone="danger">{error}</Text>
          </VStack>
        ) : null}
        {!loading && !post && !error ? (
          <VStack className="p-4">
            <Text>No encontrada.</Text>
          </VStack>
        ) : null}
        {post ? (
          <>
            <DetailHeroImage
              imageUri={imageUrl}
              fallbackImageUri={villageCover}
              fallbackIcon="newspaper-outline"
            />
            <VStack gap={3} className="p-4">
              <Text variant="h1">{post.title}</Text>
              <HStack gap={2} justify="between">
                <Text tone="muted">{t(`news.compose.category.${post.category}`)}</Text>
                {date ? <Text tone="muted">{formatDate(date, 'long')}</Text> : null}
              </HStack>
              <Text>{post.body}</Text>
            </VStack>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
