import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FloatingBackButton } from './FloatingBackButton';

/**
 * Full-bleed hero image shown at the top of event/news detail screens. Mirrors
 * the FeedCard image chain: the item's own image → the village cover photo
 * (`fallbackImageUri`) → a tinted placeholder with `fallbackIcon`. Renders a
 * floating back button over its top-left corner so the detail screen needs no
 * header bar (set `showBack={false}` to suppress it).
 */

// Width:height. Matches FeedCard so the card image and the detail hero agree.
const ASPECT_RATIO = 4 / 3;
const PLACEHOLDER_BG = '#dcab93'; // palette.peach

export type DetailHeroImageProps = {
  imageUri: string | null;
  fallbackImageUri?: string | null;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
  /** Render the floating back button over the image. Defaults to true. */
  showBack?: boolean;
  /** Custom back handler (defaults to router.back). */
  onBack?: () => void;
};

export function DetailHeroImage({
  imageUri,
  fallbackImageUri = null,
  fallbackIcon,
  showBack = true,
  onBack,
}: DetailHeroImageProps) {
  const displayUri = imageUri ?? fallbackImageUri;
  return (
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
          <Ionicons name={fallbackIcon} size={72} color="#ffffff" />
        </View>
      )}
      {showBack ? <FloatingBackButton onBack={onBack} /> : null}
    </View>
  );
}
