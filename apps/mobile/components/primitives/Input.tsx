import type { ReactNode } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';
import { colors } from '@cultuvilla/shared/design-system';
import { Text } from './Text';
import { FieldLabel } from './FieldLabel';
import { VStack } from './VStack';

export type InputProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (next: string) => void;
  label?: string;
  error?: string;
  /** Node rendered inside the bordered area on the right, vertically centered. */
  rightAdornment?: ReactNode;
  /** Tighter vertical padding (e.g. dense forms). */
  dense?: boolean;
  /** Fully rounded accent-outlined capsule, no fill (chat/comment composers). */
  pill?: boolean;
};

// Controlled text input. `onChangeText` (vs `onChange`) keeps the API aligned
// with apps/web/components/primitives/Input.tsx — and with React Native
// convention. Label and error are rendered inline.
export function Input({
  label,
  value,
  onChangeText,
  error,
  rightAdornment,
  dense = false,
  pill = false,
  ...rest
}: InputProps) {
  return (
    <VStack gap={1}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <View
        className={`flex-row items-center border ${
          pill ? 'rounded-full px-4 gap-2 py-2' : `rounded-md px-3 bg-surface ${dense ? 'py-1' : 'py-2'}`
        } ${error ? 'border-danger' : pill ? 'border-accent' : 'border-subtle'}`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
          placeholderTextColor={pill ? colors.light.fg.accent : undefined}
          className={`flex-1 text-body ${pill ? 'text-accent' : 'text-primary'}`}
          textAlignVertical={rest.multiline ? 'top' : 'center'}
          // The visible box height is dominated by the field's own intrinsic
          // padding (large on Android) + font padding, NOT the wrapper's py-*.
          // In dense/pill mode we zero both so the wrapper padding alone sets height.
          style={dense || pill ? { paddingVertical: 0, includeFontPadding: false } : undefined}
          {...rest}
        />
        {rightAdornment}
      </View>
      {error && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
    </VStack>
  );
}
