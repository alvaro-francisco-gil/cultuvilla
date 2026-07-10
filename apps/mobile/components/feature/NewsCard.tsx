import { useEffect, useState } from 'react';
import { FeedCard } from './FeedCard';
import { useT } from '../../lib/i18n';
import { newsImageDownloadURL } from '@cultuvilla/shared/services/imageService';
import { relativeDayLabel } from '../../lib/relativeDayLabel';
import type {
  NewsPostCategory,
  NewsPostImage,
} from '@cultuvilla/shared/models/news/NewsPostDataModel';

/** Minimal news shape consumed by this card. */
export type NewsLike = {
  id: string;
  title: string;
  category: NewsPostCategory;
  publishedAt: Date | null;
  createdAt: Date;
  images: NewsPostImage[];
  coverImage?: NewsPostImage | null;
};

export type NewsCardProps = {
  post: NewsLike;
  /** Village cover photo, used as the fallback when the post has no image. */
  fallbackImageUri?: string | null;
  onPress: (id: string) => void;
  testID?: string;
};

export function NewsCard({ post, fallbackImageUri = null, onPress, testID }: NewsCardProps) {
  const { t } = useT();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const firstImagePath = post.coverImage?.storagePath ?? post.images[0]?.storagePath ?? null;
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

  const date = post.publishedAt ?? post.createdAt;

  return (
    <FeedCard
      imageUri={imageUrl}
      fallbackImageUri={fallbackImageUri}
      title={post.title}
      metaLeft={t(`news.compose.category.${post.category}`)}
      metaRight={relativeDayLabel(date, t)}
      fallbackIcon="newspaper-outline"
      onPress={() => onPress(post.id)}
      testID={testID}
    />
  );
}
