import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Pressable } from '../primitives/Pressable';
import { Card } from '../primitives/Card';
import { VStack } from '../primitives/VStack';
import { HStack } from '../primitives/HStack';
import { Text } from '../primitives/Text';
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
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  const firstImagePath = post.images[0]?.storagePath ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!firstImagePath) {
      setThumbUrl(null);
      return;
    }
    newsImageDownloadURL(firstImagePath)
      .then((url) => {
        if (!cancelled) setThumbUrl(url);
      })
      .catch(() => {
        if (!cancelled) setThumbUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [firstImagePath]);

  const date = post.publishedAt ?? post.submittedAt;

  return (
    <Pressable onPress={() => onPress(post.id)} testID={testID}>
      <Card>
        <HStack gap={3} justify="between">
          <VStack gap={2} className="flex-1">
            <Text variant="h3">{post.title}</Text>
            <HStack gap={2} justify="between">
              <Text tone="muted">{t(`news.compose.category.${post.category}`)}</Text>
              <Text tone="muted">{formatDate(date, 'short')}</Text>
            </HStack>
          </VStack>
          {thumbUrl ? (
            <Image
              source={{ uri: thumbUrl }}
              style={{ width: 56, height: 56, borderRadius: 8 }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View />
          )}
        </HStack>
      </Card>
    </Pressable>
  );
}
