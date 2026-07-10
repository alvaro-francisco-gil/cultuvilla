import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { iconSizes, colors } from '@cultuvilla/shared/design-system';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { HStack } from './HStack';

export interface CheckboxProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** A plain string renders inside a Text; a node (e.g. label with links) renders as-is. */
  label?: ReactNode;
  testID?: string;
}

// Square consent checkbox. Track/box use plain `View` (not Animated.View) to
// satisfy the NativeWind/RN-Web constraint that styles must not go on the
// className of Animated components. Token names mirror Toggle:
//   bg-accent / border-accent  — checked
//   bg-surface / border-subtle — unchecked
export function Checkbox({ value, onValueChange, label, testID }: CheckboxProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
    >
      <HStack gap={2} align="center">
        <View
          className={`w-6 h-6 rounded-sm border items-center justify-center ${
            value ? 'bg-accent border-accent' : 'bg-surface border-subtle'
          }`}
        >
          {value ? (
            <Ionicons
              name="checkmark"
              size={iconSizes.sm}
              color={colors.light.fg['on-accent']}
            />
          ) : null}
        </View>
        {typeof label === 'string' ? <Text>{label}</Text> : label}
      </HStack>
    </Pressable>
  );
}
