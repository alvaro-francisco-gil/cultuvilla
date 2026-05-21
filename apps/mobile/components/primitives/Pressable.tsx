import { Pressable as RNPressable, type PressableProps as RNPressableProps } from 'react-native';
import type { ReactNode } from 'react';
import { a11y } from '@cultuvilla/shared/design-system';

export type PressableProps = Omit<RNPressableProps, 'children'> & {
  children: ReactNode;
  /** Additional NativeWind class names */
  className?: string;
  onPress: () => void;
};

// Interactive wrapper. `onPress` keeps the API aligned with React Native
// and with apps/web/components/primitives/Pressable.tsx. Enforces the 44px
// touch target via defaultHitSlop and dims on press.
export function Pressable({ children, className, disabled, onPress, ...rest }: PressableProps) {
  return (
    <RNPressable
      hitSlop={a11y.defaultHitSlop}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      className={className}
      style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
      {...rest}
    >
      {children}
    </RNPressable>
  );
}
