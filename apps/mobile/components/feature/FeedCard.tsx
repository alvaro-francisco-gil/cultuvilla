import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';
import { TopCropImage } from '../primitives/TopCropImage';
import { iconSizes } from '@cultuvilla/shared/design-system';

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
const BADGE_BG = '#bb5d3a'; // palette.accent

export type FeedCardProps = {
  imageUri: string | null;
  /** Village cover photo, shown when the item has no image of its own. */
  fallbackImageUri?: string | null;
  title: string;
  metaLeft: string | null;
  metaRight: string;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  /** Optional pill shown over the top-left of the image (e.g. "En curso"). */
  badge?: string | null;
  /** Comment count shown alongside `metaRight` in the bottom scrim, when > 0. */
  commentCount?: number;
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
  badge = null,
  commentCount,
  onPress,
  testID,
}: FeedCardProps) {
  const displayUri = imageUri ?? fallbackImageUri;
  return (
    <Pressable onPress={onPress} testID={testID}>
      <View className="rounded-lg overflow-hidden bg-surface border border-subtle">
        <View style={{ width: '100%', aspectRatio: ASPECT_RATIO }}>
          {displayUri ? (
            <TopCropImage uri={displayUri} />
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
              paddingTop: 14,
              paddingBottom: 14,
              backgroundColor: 'rgba(0,0,0,0.6)',
            }}
          >
            {/* One line only — ellipsise rather than wrap to a second line. */}
            <Text variant="h1" numberOfLines={1} style={{ color: '#ffffff', fontSize: 22 }}>
              {title}
            </Text>
            {/* Location + date on one row. Location takes the slack and ellipsises
                when long; the date sits at the right and is never trimmed. */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
              <Text
                variant="body"
                numberOfLines={1}
                style={{ color: 'rgba(255,255,255,0.85)', flex: 1, marginRight: 8 }}
              >
                {metaLeft}
              </Text>
              <Text
                variant="body"
                numberOfLines={1}
                style={{ color: 'rgba(255,255,255,0.85)', flexShrink: 0 }}
              >
                {metaRight}
              </Text>
              {commentCount && commentCount > 0 ? (
                <View
                  testID="feed-card-comment-count"
                  style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, flexShrink: 0 }}
                >
                  <Ionicons name="chatbubble-outline" size={iconSizes.sm} color="rgba(255,255,255,0.85)" />
                  <Text
                    variant="body"
                    numberOfLines={1}
                    style={{ color: 'rgba(255,255,255,0.85)', marginLeft: 4 }}
                  >
                    {commentCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {badge ? (
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 9999,
                backgroundColor: BADGE_BG,
              }}
            >
              <Text variant="bodySm" style={{ color: '#ffffff' }} numberOfLines={1}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
