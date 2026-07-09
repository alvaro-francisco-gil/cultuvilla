import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

/**
 * A cover-cropped image anchored to the TOP of its box instead of the centre.
 *
 * React Native's `resizeMode="cover"` always centre-crops, so a tall flyer
 * loses its top and bottom equally — the eye-catching header of an event
 * poster ends up trimmed. Here we read the natural size (via `Image.getSize`,
 * which works on native and RN-Web), scale the picture to cover the box, and
 * pin it to the top edge (centred horizontally). Tall images therefore keep
 * their top and overflow the bottom, which the clipping container hides.
 *
 * The component fills its parent (position it inside a sized, `overflow-hidden`
 * box) and measures its own laid-out size with `onLayout`, so it works whether
 * the parent is a fixed pixel square or a full-width `aspectRatio` box. Until
 * both the layout and the natural size resolve it just fills the box, so
 * square/landscape images never jump.
 */
export type TopCropImageProps = {
  uri: string;
};

export function TopCropImage({ uri }: TopCropImageProps) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let active = true;
    setRatio(null);
    Image.getSize(
      uri,
      (w, h) => {
        if (active && w > 0 && h > 0) setRatio(w / h);
      },
      () => {
        // Fall back to a plain fill if the natural size can't be read.
      },
    );
    return () => {
      active = false;
    };
  }, [uri]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setBox({ width, height });
  };

  let imageStyle: object = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' };
  if (box && ratio) {
    const boxRatio = box.width / box.height;
    // Cover: the axis where the image is relatively smaller must fill the box.
    const wider = ratio > boxRatio;
    const displayW = wider ? box.height * ratio : box.width;
    const displayH = wider ? box.height : box.width / ratio;
    imageStyle = {
      position: 'absolute',
      top: 0,
      left: (box.width - displayW) / 2,
      width: displayW,
      height: displayH,
    };
  }

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} onLayout={onLayout}>
      <Image source={{ uri }} style={imageStyle} resizeMode="cover" accessibilityIgnoresInvertColors />
    </View>
  );
}
