import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';

/**
 * Image-forward feed card shared by EventCard and NewsCard. The image fills
 * the whole card (full-bleed, no padding) at a fixed aspect ratio; the title
 * and meta sit over a dark scrim pinned to the bottom so the picture stays as
 * large as possible. When the item has no image of its own we fall back to the
 * village's cover photo (`fallbackImageUri`), then to a tinted placeholder with
 * `fallbackIcon`.
 */

// Width:height. Taller than 16:9 so the picture dominates the card.
const ASPECT_RATIO = 4 / 3;
const PLACEHOLDER_BG = '#dcab93'; // palette.peach

export type FeedCardProps = {
  imageUri: string | null;
  /** Village cover photo, shown when the item has no image of its own. */
  fallbackImageUri?: string | null;
  title: string;
  metaLeft: string;
  metaRight: string;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID?: string;
};

export function FeedCard({
  imageUri,
  fallbackImageUri = null,
  title,
  metaLeft,
  metaRight,
  fallbackIcon,
  onPress,
  testID,
}: FeedCardProps) {
  const displayUri = imageUri ?? fallbackImageUri;
  return (
    <Pressable onPress={onPress} testID={testID}>
      <View className="rounded-lg overflow-hidden bg-surface border border-subtle">
        <View style={{ width: '100%', aspectRatio: ASPECT_RATIO }}>
          {displayUri ? (
            <Image
              source={{ uri: displayUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              className="items-center justify-center"
              style={{ width: '100%', height: '100%', backgroundColor: PLACEHOLDER_BG }}
            >
              <Ionicons name={fallbackIcon} size={64} color="#ffffff" />
            </View>
          )}

          {/* Bottom scrim keeps the overlaid text legible against any photo. */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12,
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
          >
            <Text variant="h3" numberOfLines={2} style={{ color: '#ffffff' }}>
              {title}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: 'rgba(255,255,255,0.85)', flex: 1, marginRight: 8 }}
              >
                {metaLeft}
              </Text>
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.85)' }}>
                {metaRight}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
