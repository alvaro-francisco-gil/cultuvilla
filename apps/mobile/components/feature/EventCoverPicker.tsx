import { useState } from 'react';
import { Image, View } from 'react-native';
import type { ImageLoadEventData, NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@cultuvilla/shared/design-system';
import { Pressable } from '../primitives/Pressable';

const ACCENT = colors.light.fg.accent;

export interface EventCoverPickerProps {
  /** Preview URI of the picked/existing image, or null for the empty state. */
  uri?: string | null;
  onPress: () => void;
  /** Accessibility label (e.g. "Añadir imagen"). */
  label: string;
}

/**
 * Event cover picker. The full flyer is uploaded at whatever resolution the
 * user picked, so the preview shows the WHOLE image at its natural aspect
 * ratio. Over it we highlight the top square — the region that becomes the
 * (square) cover/card thumbnail — by dimming everything outside it and
 * outlining it, so the author sees which part of their flyer is used.
 *
 * The square is anchored to the top and centered horizontally, matching the
 * top-aligned crop the cards apply (see FeedCard). Its geometry is derived from
 * the image's natural ratio `a = width / height`:
 *   widthFrac = min(1, 1/a)   heightFrac = min(1, a)   leftFrac = (1 - widthFrac)/2
 * i.e. a tall (portrait) flyer highlights a full-width band at the top; a wide
 * one highlights a centered square spanning the full height.
 */
export function EventCoverPicker({ uri, onPress, label }: EventCoverPickerProps) {
  // Natural ratio comes from the rendered image's onLoad (not Image.getSize,
  // which is imperative and fragile under the test mock). Until it loads we
  // render a square, which is also the fallback if the ratio never resolves.
  const [ratio, setRatio] = useState(1);

  const onLoad = (e: NativeSyntheticEvent<ImageLoadEventData>) => {
    const src = e.nativeEvent?.source;
    if (src && src.width > 0 && src.height > 0) setRatio(src.width / src.height);
  };

  // Empty state: dashed "add" card, square, matching the other image inputs.
  if (!uri) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel={label}
        className="rounded-2xl overflow-hidden border border-dashed border-subtle items-center justify-center"
        style={{ width: '100%', aspectRatio: 1 }}
      >
        <Ionicons name="add" size={44} color={ACCENT} />
      </Pressable>
    );
  }

  const widthFrac = Math.min(1, 1 / ratio);
  const heightFrac = Math.min(1, ratio);
  const sideMargin = (1 - widthFrac) / 2;
  const pct = (n: number): `${number}%` => `${n * 100}%`;
  const dim = 'rgba(0,0,0,0.5)';

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className="rounded-2xl overflow-hidden border border-subtle"
      style={{ width: '100%', aspectRatio: ratio }}
    >
      <Image
        source={{ uri }}
        onLoad={onLoad}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      {/* Dim below the square (portrait flyers). */}
      <View
        style={{ position: 'absolute', left: 0, right: 0, top: pct(heightFrac), bottom: 0, backgroundColor: dim }}
      />
      {/* Dim left/right of the square (wide flyers). */}
      <View
        style={{ position: 'absolute', left: 0, top: 0, width: pct(sideMargin), height: pct(heightFrac), backgroundColor: dim }}
      />
      <View
        style={{ position: 'absolute', right: 0, top: 0, width: pct(sideMargin), height: pct(heightFrac), backgroundColor: dim }}
      />
      {/* Outline the highlighted top square. */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: pct(sideMargin),
          width: pct(widthFrac),
          height: pct(heightFrac),
          borderColor: ACCENT,
          borderWidth: 2,
        }}
      />
    </Pressable>
  );
}
