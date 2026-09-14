import { Image, View, useWindowDimensions } from 'react-native';
import { WRAPPED_CARDS, type WrappedData } from '@cultuvilla/shared/models';
import { Button, HStack, Text, VStack } from '../../primitives';
import { useT } from '../../../lib/i18n';

const CARD_ASPECT = 1920 / 1080;
const MAX_CARD_WIDTH = 420;

interface Props {
  wrapped: Pick<WrappedData, 'status' | 'images' | 'autoPublishAt'>;
  onPublish: () => void;
  onDiscard: () => void;
  deciding: boolean;
}

/** The rendered cards, in order, with the admin's decision on a draft. */
export function WrappedReview({ wrapped, onPublish, onDiscard, deciding }: Props) {
  const { t } = useT();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 32, MAX_CARD_WIDTH);
  const cards = WRAPPED_CARDS.flatMap((card) => {
    const url = wrapped.images[card];
    return url ? [{ card, url }] : [];
  });

  return (
    <VStack gap={4}>
      <View className="rounded-md bg-surface-elevated p-3" testID="wrapped-status">
        <Text variant="h3">{t(`village.wrapped.status.${wrapped.status}`)}</Text>
        <Text variant="caption" tone="muted">
          {wrapped.status === 'draft'
            ? wrapped.autoPublishAt
              ? t('village.wrapped.draftAutoPublish')
              : t('village.wrapped.draftHeldBack')
            : t(`village.wrapped.statusHelp.${wrapped.status}`)}
        </Text>
      </View>

      {wrapped.status === 'draft' ? (
        <HStack gap={2}>
          <View className="flex-1">
            <Button variant="secondary" onPress={onDiscard} disabled={deciding} fullWidth testID="wrapped-discard">
              {t('village.wrapped.discard')}
            </Button>
          </View>
          <View className="flex-1">
            <Button onPress={onPublish} loading={deciding} disabled={deciding} fullWidth testID="wrapped-publish">
              {t('village.wrapped.publish')}
            </Button>
          </View>
        </HStack>
      ) : null}

      {cards.map(({ card, url }) => (
        <Image
          key={card}
          source={{ uri: url }}
          accessibilityLabel={t(`village.wrapped.card.${card}`)}
          testID={`wrapped-card-${card}`}
          style={{ width: cardWidth, height: cardWidth * CARD_ASPECT, borderRadius: 12, alignSelf: 'center' }}
          resizeMode="cover"
        />
      ))}
    </VStack>
  );
}
