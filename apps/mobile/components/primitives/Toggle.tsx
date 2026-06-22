import { View } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { HStack } from './HStack';

export interface ToggleProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: string;
  testID?: string;
}

// Yes/no toggle switch. Track and thumb use plain `View` (not Animated.View)
// to satisfy the NativeWind/RN-Web constraint: styles must not go on className
// of Animated components. Token names match existing primitives:
//   bg-accent  — active track  (same as Button primary)
//   bg-subtle  — inactive track (same as Button secondary / Input border)
//   bg-surface — thumb  (same as Input background)
export function Toggle({ value, onValueChange, label, testID }: ToggleProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
    >
      <HStack gap={2} align="center">
        <View
          className={`w-12 h-7 rounded-full px-1 justify-center ${
            value ? 'bg-accent' : 'bg-subtle'
          }`}
        >
          <View
            className={`w-5 h-5 rounded-full bg-surface ${
              value ? 'self-end' : 'self-start'
            }`}
          />
        </View>
        {label ? <Text>{label}</Text> : null}
      </HStack>
    </Pressable>
  );
}
