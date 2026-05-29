import type { ReactNode } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';
import { Text } from './Text';
import { VStack } from './VStack';

export type InputProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (next: string) => void;
  label?: string;
  error?: string;
  /** Node rendered inside the bordered area on the right, vertically centered. */
  rightAdornment?: ReactNode;
};

// Controlled text input. `onChangeText` (vs `onChange`) keeps the API aligned
// with apps/web/components/primitives/Input.tsx — and with React Native
// convention. Label and error are rendered inline.
export function Input({ label, value, onChangeText, error, rightAdornment, ...rest }: InputProps) {
  return (
    <VStack gap={1}>
      {label && (
        <Text variant="bodySm" tone="muted">
          {label}
        </Text>
      )}
      <View
        className={`flex-row items-center border rounded-md px-3 py-2 bg-surface ${
          error ? 'border-danger' : 'border-subtle'
        }`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          className="flex-1 text-primary text-body"
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
