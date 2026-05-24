import { useEffect, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import { Pressable } from '../primitives/Pressable';
import { Text } from '../primitives/Text';

export type SegmentedToggleOption<T extends string> = {
  value: T;
  label: string;
};

export type SegmentedToggleProps<T extends string> = {
  options: readonly SegmentedToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Pill-style segmented toggle with an animated sliding indicator.
 * Inspired by ordago-apps' TORNEOS/PARTIDAS switch.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: SegmentedToggleProps<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value),
  );
  const indicatorAnim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  }, [activeIndex, indicatorAnim]);

  const segmentWidth = trackWidth > 0 ? Math.max((trackWidth - 4) / options.length, 0) : 0;

  return (
    <View
      className="flex-row bg-subtle rounded-md p-[2px]"
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View
        pointerEvents="none"
        className="absolute bg-surface rounded-md"
        style={{
          top: 2,
          bottom: 2,
          left: 2,
          width: segmentWidth,
          transform: [
            {
              translateX: indicatorAnim.interpolate({
                inputRange: options.map((_, i) => i),
                outputRange: options.map((_, i) => i * segmentWidth),
              }),
            },
          ],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 2,
          elevation: 2,
        }}
      />
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className="flex-1 py-2 items-center justify-center"
          >
            <Text
              variant="caption"
              tone={isActive ? 'primary' : 'muted'}
              className="uppercase font-semibold"
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
