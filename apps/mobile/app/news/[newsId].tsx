import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { getNewsPost } from '@cultuvilla/shared/services/newsService';
import type { NewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';

type Post = NewsPostData & { id: string };

export default function NewsDetailStub() {
  const { newsId } = useLocalSearchParams<{ newsId: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!newsId) return;
    getNewsPost(newsId as string)
      .then((p) => setPost(p))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [newsId]);

  return (
    <Screen>
      <AppHeader centerLabel={post?.title ?? 'Noticia'} />
      <VStack className="p-4 gap-3">
        {loading ? <ActivityIndicator /> : null}
        {error ? <Text tone="danger">{error}</Text> : null}
        {!loading && !post && !error ? <Text>No encontrada.</Text> : null}
        {post ? <Text>{post.body}</Text> : null}
      </VStack>
    </Screen>
  );
}
