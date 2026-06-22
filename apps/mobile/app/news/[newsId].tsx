import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { HStack } from '../../components/primitives/HStack';
import { DetailHeroImage } from '../../components/feature/DetailHeroImage';
import { LiveOwnerChip } from '../../components/feature/LiveOwnerChip';
import { FloatingBackButton } from '../../components/feature/FloatingBackButton';
import { FloatingShareButton } from '../../components/feature/FloatingShareButton';
import { useT } from '../../lib/i18n';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { getNewsLink } from '@cultuvilla/shared/services/deepLinkService';
import { getNewsPost } from '@cultuvilla/shared/services/newsService';
import { newsImageDownloadURL } from '@cultuvilla/shared/services/imageService';
import { formatDate } from '@cultuvilla/shared/utils';
import type { NewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';

type Post = NewsPostData & { id: string };

export default function NewsDetailScreen() {
  const { newsId } = useLocalSearchParams<{ newsId: string }>();
  const { t } = useT();
  const share = useShareDeepLink();
  const [post, setPost] = useState<Post | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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

  const date = post ? (post.publishedAt ?? post.submittedAt) : null;

  return (
    <Screen padded={false} topInset={false}>
      <StatusBar style="light" />
      {!post ? <FloatingBackButton /> : null}
      {post ? (
        <FloatingShareButton onPress={() => void share(getNewsLink(post.id), post.title)} />
      ) : null}
      <ScrollView>
        {loading ? (
          <VStack className="p-4 pt-16">
            <ActivityIndicator />
          </VStack>
        ) : null}
        {error ? (
          <VStack className="p-4 pt-16">
            <Text tone="danger">{error}</Text>
          </VStack>
        ) : null}
        {!loading && !post && !error ? (
          <VStack className="p-4 pt-16">
            <Text>No encontrada.</Text>
          </VStack>
        ) : null}
        {post ? (
          <>
            <DetailHeroImage
              imageUri={imageUrl}
              fallbackImageUri={null}
              fallbackIcon="newspaper-outline"
            />
            <VStack gap={3} className="p-4">
              <Text variant="h1">{post.title}</Text>
              <LiveOwnerChip
                ownerId={post.authorOrgId ?? post.authorUserId}
                ownerType={post.authorOrgId ? 'organization' : 'user'}
                size={28}
                tone="muted"
              />
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
