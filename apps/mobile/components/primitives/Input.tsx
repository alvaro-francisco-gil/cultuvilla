import type { ReactNode } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';
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
};

// Controlled text input. `onChangeText` (vs `onChange`) keeps the API aligned
// with apps/web/components/primitives/Input.tsx — and with React Native
// convention. Label and error are rendered inline.
export function Input({ label, value, onChangeText, error, rightAdornment, dense = false, ...rest }: InputProps) {
  return (
    <VStack gap={1}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <View
        className={`flex-row items-center border rounded-md px-3 ${dense ? 'py-1' : 'py-2'} bg-surface ${
          error ? 'border-danger' : 'border-subtle'
        }`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
          className="flex-1 text-primary text-body"
          textAlignVertical={rest.multiline ? 'top' : 'center'}
          // The visible box height is dominated by the field's own intrinsic
          // padding (large on Android) + font padding, NOT the wrapper's py-*.
          // In dense mode we zero both so the wrapper padding alone sets height.
          style={dense ? { paddingVertical: 0, includeFontPadding: false } : undefined}
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
