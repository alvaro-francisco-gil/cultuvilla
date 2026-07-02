import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { HStack } from '../../components/primitives/HStack';
import { DetailHeroImage } from '../../components/feature/DetailHeroImage';
import { NewsContentRenderer } from '../../components/feature/NewsContentRenderer';
import { LiveOwnerChip } from '../../components/feature/LiveOwnerChip';
import { FloatingBackButton } from '../../components/feature/FloatingBackButton';
import { FloatingShareButton } from '../../components/feature/FloatingShareButton';
import { FloatingEditButton } from '../../components/feature/FloatingEditButton';
import { useAuth } from '../../lib/auth/useAuth';
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
  const { user } = useAuth();
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

  // Resolve the cover to a download URL. Prefer the dedicated coverImage; fall
  // back to legacy images[0] for posts authored before covers existed.
  const firstImagePath = post?.coverImage?.storagePath ?? post?.images[0]?.storagePath ?? null;
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
  // Mirrors the news update rules: the author or a named organizer may edit.
  const canEdit =
    !!user &&
    !!post &&
    (post.createdBy === user.uid || post.organizerUserIds.includes(user.uid));

  return (
    <Screen padded={false} topInset={false}>
      <StatusBar style="light" />
      {!post ? <FloatingBackButton /> : null}
      {post ? (
        <FloatingShareButton onPress={() => void share(getNewsLink(post.id), post.title)} />
      ) : null}
      {canEdit && post ? (
        <FloatingEditButton
          accessibilityLabel={t('news.compose.editTitle')}
          onPress={() => router.push(`/news/new?newsId=${post.id}` as never)}
        />
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
              {post.organizerOrgIds.map((id) => (
                <LiveOwnerChip key={id} ownerId={id} ownerType="organization" size={28} tone="muted" />
              ))}
              {post.organizerUserIds.map((id) => (
                <LiveOwnerChip key={id} ownerId={id} ownerType="user" size={28} tone="muted" />
              ))}
              <HStack gap={2} justify="between">
                <Text tone="muted">{t(`news.compose.category.${post.category}`)}</Text>
                {date ? <Text tone="muted">{formatDate(date, 'long')}</Text> : null}
              </HStack>
              <NewsContentRenderer
                content={post.content}
                body={post.body}
                municipalityId={post.municipalityId}
              />
            </VStack>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
