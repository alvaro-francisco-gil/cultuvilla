import { ActivityIndicator, View } from 'react-native';
import type { ReactNode } from 'react';
import { Pressable } from './Pressable';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

export interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  testID?: string;
}

const VARIANT_BG: Record<Variant, string> = {
  primary: 'bg-accent',
  secondary: 'bg-subtle',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
};

const VARIANT_TONE: Record<Variant, 'primary' | 'muted' | 'onAccent' | 'danger'> = {
  primary: 'onAccent',
  secondary: 'primary',
  ghost: 'primary',
  danger: 'onAccent',
};

const SIZE_CLASS: Record<Size, string> = {
  md: 'px-4 py-2',
  lg: 'px-6 py-3',
};

// Button primitive. Mirrors apps/web/components/primitives/Button.tsx prop API
// (children, onPress, variant, size, loading, disabled, fullWidth).
export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const parts = [
    'rounded-md items-center justify-center flex-row',
    VARIANT_BG[variant],
    SIZE_CLASS[size],
    isDisabled ? 'opacity-50' : '',
    fullWidth ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={parts}
      testID={testID}
    >
      <View className="flex-row items-center gap-2">
        {loading && (
          <ActivityIndicator testID={`${testID ?? 'btn'}-spinner`} />
        )}
        <Text tone={VARIANT_TONE[variant]}>{children}</Text>
      </View>
    </Pressable>
  );
}
