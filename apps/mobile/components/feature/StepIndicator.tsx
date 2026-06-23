// apps/mobile/components/feature/StepIndicator.tsx
import { Fragment } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives';
import { colors, palette } from '@cultuvilla/shared/design-system';

type Glyph = keyof typeof Ionicons.glyphMap;

export interface StepIndicatorProps {
  count: number;
  current: number;
  highestReached: number;
  onStepPress: (index: number) => void;
  /** Ionicons glyph per step; falls back to a neutral dot when absent. */
  icons?: (Glyph | undefined)[];
  /** Accessibility label per step (the step title), since dots show no text. */
  labels?: (string | undefined)[];
}

// Ionicons take a color value, not a NativeWind class — source it from the
// tokens. Both reached and locked icons stay in the orange family (locked is a
// lighter clay), so no step icon ever reads as green.
const ACCENT = colors.light.fg.accent;
const LOCKED = palette.clay;

export function StepIndicator({
  count,
  current,
  highestReached,
  onStepPress,
  icons,
  labels,
}: StepIndicatorProps) {
  return (
    <View className="flex-row items-center px-5 py-3">
      {Array.from({ length: count }, (_, i) => {
        const reached = i <= highestReached;
        const glyph: Glyph = icons?.[i] ?? 'ellipse';
        return (
          <Fragment key={i}>
            <Pressable
              testID={`step-dot-${i}`}
              accessibilityLabel={labels?.[i]}
              disabled={!reached}
              onPress={() => onStepPress(i)}
              className={`w-10 h-10 rounded-full border bg-surface-elevated items-center justify-center ${
                reached ? 'border-accent' : 'border-subtle'
              }`}
            >
              <Ionicons name={glyph} size={20} color={reached ? ACCENT : LOCKED} />
            </Pressable>
            {i < count - 1 && (
              <View className={`flex-1 h-0.5 mx-2 ${i < current ? 'bg-accent' : 'bg-subtle'}`} />
            )}
          </Fragment>
        );
      })}
    </View>
  );
}
