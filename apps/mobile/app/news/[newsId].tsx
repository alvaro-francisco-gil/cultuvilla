import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Text } from '../../components/primitives/Text';
import { HStack } from '../../components/primitives/HStack';
import { EntityDetailScaffold } from '../../components/feature/EntityDetailScaffold';
import type { EntityDetailAction } from '../../components/feature/EntityDetailHeader';
import { ENTITY_FALLBACK_ICON } from '../../lib/entities/registry';
import { NewsContentRenderer } from '../../components/feature/NewsContentRenderer';
import { LiveOwnerChip } from '../../components/feature/LiveOwnerChip';
import { useAuth } from '../../lib/auth/useAuth';
import { useEntityCapabilities } from '../../lib/auth/useEntityCapabilities';
import { useT } from '../../lib/i18n';
import { showConfirm } from '../../lib/dialogs';
import { useShareDeepLink } from '../../lib/deeplink/useShareDeepLink';
import { getNewsLink } from '@cultuvilla/shared/services/deepLinkService';
import { getNewsPost } from '@cultuvilla/shared/services/newsService';
import { hideContent, unhideContent } from '@cultuvilla/shared/services/moderationService';
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

  useEffect(() => {
    if (!newsId) return;
    getNewsPost(newsId as string)
      .then((p) => setPost(p))
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [newsId]);

  const { canManage } = useEntityCapabilities(post?.municipalityId);

  // Refetch without re-triggering the full-screen loading state — used after
  // an admin toggles visibility so the badge/action flip in place.
  const refreshPost = () => {
    if (!newsId) return;
    void getNewsPost(newsId as string).then((p) => setPost(p));
  };

  const toggleVisibility = () => {
    if (!post) return;
    if (post.status === 'active') {
      showConfirm(
        t('news.moderation.hideConfirmTitle'),
        t('news.moderation.hideConfirmBody'),
        () => void hideContent({ collection: 'news', docId: post.id }).then(refreshPost),
        { confirmText: t('common.hide'), cancelText: t('common.cancel') },
      );
    } else {
      void unhideContent({ collection: 'news', docId: post.id }).then(refreshPost);
    }
  };

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

  const date = post ? (post.publishedAt ?? post.createdAt) : null;
  // Mirrors the news update rules: the author or a named organizer may edit.
  const canEdit =
    !!user && !!post && (post.createdBy === user.uid || post.organizerUserIds.includes(user.uid));

  const actions: EntityDetailAction[] = post
    ? [
        ...(canEdit
          ? [
              {
                icon: 'create-outline' as const,
                accessibilityLabel: t('news.compose.editTitle'),
                onPress: () => router.push(`/news/new?newsId=${post.id}` as never),
              },
            ]
          : []),
        ...(canManage
          ? [
              {
                icon:
                  post.status === 'active'
                    ? ('eye-off-outline' as const)
                    : ('eye-outline' as const),
                accessibilityLabel:
                  post.status === 'active' ? t('news.moderation.hide') : t('news.moderation.unhide'),
                onPress: toggleVisibility,
              },
            ]
          : []),
        {
          icon: 'share-outline',
          accessibilityLabel: t('deeplink.shareViewLabel'),
          onPress: () => void share(getNewsLink(post.id), post.title),
        },
      ]
    : [];

  return (
    <EntityDetailScaffold
      loading={loading}
      notFound={!loading && !post}
      imageUri={imageUrl}
      fallbackIcon={ENTITY_FALLBACK_ICON.news}
      actions={actions}
      title={post?.title}
    >
      {post ? (
        <>
          {post.status === 'hidden' ? (
            <View className="px-2 py-0.5 rounded-full bg-red-100 self-start">
              <Text variant="caption" className="text-red-800">
                {t('news.moderation.hiddenBadge')}
              </Text>
            </View>
          ) : null}
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
          <NewsContentRenderer content={post.content} body={post.body} municipalityId={post.municipalityId} />
        </>
      ) : null}
    </EntityDetailScaffold>
  );
}
