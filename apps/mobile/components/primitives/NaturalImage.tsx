import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

/**
 * Full-width image shown at its natural aspect ratio — the whole picture is
 * visible, never cropped. The container's height is derived from the image's
 * real dimensions (read via `Image.getSize`, which works on native and RN-Web),
 * so width fills the parent and height follows the photo's proportions.
 *
 * Before the dimensions resolve we render at `initialAspectRatio` (default 4:3)
 * to reserve space and avoid a layout jump; once the real ratio loads the box
 * snaps to it. `resizeMode="cover"` is safe here because the container ratio
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
    let active = true;
    setRatio(initialAspectRatio);
    Image.getSize(
      uri,
      (width, height) => {
        if (active && width > 0 && height > 0) setRatio(width / height);
      },
      () => {
        // Keep the initial ratio if the natural size can't be read.
      },
    );
    return () => {
      active = false;
    };
  }, [uri, initialAspectRatio]);

  return (
    <View className={className} style={{ width: '100%', aspectRatio: ratio }}>
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
