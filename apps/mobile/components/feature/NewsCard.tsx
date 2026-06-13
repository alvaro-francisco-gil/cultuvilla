import { useEffect, useState } from 'react';
import { FeedCard } from './FeedCard';
import { useT } from '../../lib/i18n';
import { newsImageDownloadURL } from '@cultuvilla/shared/services/imageService';
import { formatDate } from '@cultuvilla/shared/utils';
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
  submittedAt: Date;
  images: NewsPostImage[];
};

export type NewsCardProps = {
  post: NewsLike;
  onPress: (id: string) => void;
  testID?: string;
};

export function NewsCard({ post, onPress, testID }: NewsCardProps) {
  const { t } = useT();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const firstImagePath = post.images[0]?.storagePath ?? null;
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

  const date = post.publishedAt ?? post.submittedAt;

  return (
    <FeedCard
      imageUri={imageUrl}
      title={post.title}
      metaLeft={t(`news.compose.category.${post.category}`)}
      metaRight={formatDate(date, 'short')}
      fallbackIcon="newspaper-outline"
      onPress={() => onPress(post.id)}
      testID={testID}
    />
  );
}
