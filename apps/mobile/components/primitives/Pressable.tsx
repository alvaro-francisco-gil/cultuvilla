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
//
// The dim is a NativeWind `active:` variant, not a pressed-state style
// callback: NativeWind applies the inline style with `{ ...style }`, which
// spreads a function to nothing and silently drops it.
export function Pressable({ children, className, disabled, onPress, ...rest }: PressableProps) {
  return (
    <RNPressable
      hitSlop={a11y.defaultHitSlop}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      className={className ? `active:opacity-70 ${className}` : 'active:opacity-70'}
      {...rest}
    >
      {children}
    </RNPressable>
  );
}
