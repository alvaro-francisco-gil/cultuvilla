import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { RemoteImage } from './RemoteImage';

/**
 * Full-width image shown at its natural aspect ratio — the whole picture is
 * visible, never cropped. The container's height is derived from the image's
 * real dimensions (reported by the decode event), so width fills the parent and
 * height follows the photo's proportions.
 *
 * Before the dimensions resolve we render at `initialAspectRatio` (default 4:3)
 * to reserve space and avoid a layout jump; once the real ratio loads the box
 * snaps to it. `contentFit="cover"` is safe here because the container ratio
 * matches the image ratio, so nothing is actually trimmed.
 */
export type NaturalImageProps = {
  uri: string;
  /** Aspect ratio (width / height) used before natural dimensions load. */
  initialAspectRatio?: number;
  className?: string;
};

export function NaturalImage({ uri, initialAspectRatio = 4 / 3, className }: NaturalImageProps) {
  const [ratio, setRatio] = useState(initialAspectRatio);

  useEffect(() => {
    setRatio(initialAspectRatio);
  }, [uri, initialAspectRatio]);

  return (
    <View className={className} style={{ width: '100%', aspectRatio: ratio }}>
      <RemoteImage
        uri={uri}
        variant="card"
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        onNaturalSize={(w, h) => { setRatio(w / h); }}
      />
    </View>
  );
}
