import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NaturalImage } from '../primitives/NaturalImage';

/**
 * Full-bleed hero image ("flyer") shown directly below the EntityDetailHeader
 * on every entity detail screen. Follows the FeedCard image chain: the item's
 * own image → the village cover photo (`fallbackImageUri`) → a tinted
 * placeholder with `fallbackIcon`. A real photo is shown at its natural aspect
 * ratio (never cropped); only the placeholder uses the fixed 4:3 box. Back /
 * share / edit affordances live in the header bar above, not on this image.
 */

// Width:height for the placeholder fallback (matches FeedCard's card image).
const ASPECT_RATIO = 4 / 3;
const PLACEHOLDER_BG = '#dcab93'; // palette.peach

export type DetailHeroImageProps = {
  imageUri: string | null;
  fallbackImageUri?: string | null;
  fallbackIcon: keyof typeof Ionicons.glyphMap;
};

export function DetailHeroImage({
  imageUri,
  fallbackImageUri = null,
  fallbackIcon,
}: DetailHeroImageProps) {
  const displayUri = imageUri ?? fallbackImageUri;
  return (
    <View style={{ width: '100%' }}>
      {displayUri ? (
        <NaturalImage uri={displayUri} initialAspectRatio={ASPECT_RATIO} />
      ) : (
        <View
          className="items-center justify-center"
          style={{ width: '100%', aspectRatio: ASPECT_RATIO, backgroundColor: PLACEHOLDER_BG }}
        >
          <Ionicons name={fallbackIcon} size={72} color="#ffffff" />
        </View>
      )}
    </View>
  );
}
