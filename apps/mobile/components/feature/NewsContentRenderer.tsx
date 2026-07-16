import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { VStack } from '../primitives';
import { RichText } from './RichText';
import { newsImageDownloadURL } from '@cultuvilla/shared/services/imageService';
import type { NewsBlock, NewsImageBlock } from '@cultuvilla/shared/models/news/NewsPostDataModel';

/** Resolve a stored inline image and render it at its natural aspect ratio. */
function InlineImage({ block, municipalityId }: { block: NewsImageBlock; municipalityId: string }) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    newsImageDownloadURL(block.storagePath)
      .then((url) => {
        if (!cancelled) setUri(url);
      })
      .catch(() => {
        if (!cancelled) setUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [block.storagePath]);

  const aspectRatio = block.width > 0 && block.height > 0 ? block.width / block.height : 16 / 9;

  return (
    <VStack gap={1}>
      <View className="overflow-hidden rounded-lg bg-surface-elevated" style={{ width: '100%', aspectRatio }}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>
      {block.caption ? (
        <RichText
          text={block.caption}
          mentions={block.captionMentions}
          links={block.captionLinks}
          marks={block.captionMarks}
          municipalityId={municipalityId}
          tone="muted"
          variant="caption"
          className="text-center"
        />
      ) : null}
    </VStack>
  );
}

interface NewsContentRendererProps {
  content: NewsBlock[];
  /** Legacy plain-text body, rendered when `content` is empty (pre-blocks posts). */
  body: string;
  /** The post's village — needed to resolve place deep-links inside mentions. */
  municipalityId: string;
}

/**
 * Render a news post's rich body: an ordered list of text (with inline
 * `@`-mentions) and image blocks. Falls back to the legacy `body` string for
 * posts authored before the block model existed.
 */
export function NewsContentRenderer({ content, body, municipalityId }: NewsContentRendererProps) {
  if (content.length === 0) {
    return <RichText text={body} mentions={[]} links={[]} municipalityId={municipalityId} />;
  }

  return (
    <VStack gap={4}>
      {content.map((block, i) =>
        block.type === 'text' ? (
          <RichText
            key={i}
            text={block.text}
            mentions={block.mentions}
            links={block.links}
            marks={block.marks}
            municipalityId={municipalityId}
          />
        ) : (
          <InlineImage key={i} block={block} municipalityId={municipalityId} />
        ),
      )}
    </VStack>
  );
}
