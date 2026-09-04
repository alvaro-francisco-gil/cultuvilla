import { useState, type ReactNode, type Ref } from 'react';
import {
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputContentSizeChangeEventData,
  type TextInputProps,
} from 'react-native';
import { colors } from '@cultuvilla/shared/design-system';
import { Text } from './Text';
import { FieldLabel } from './FieldLabel';
import { VStack } from './VStack';

/** One line of body text — the composer's resting height. */
const AUTO_GROW_MIN_HEIGHT = 20;
/** ~6 lines: enough to read a long comment whole without eating the screen. */
const AUTO_GROW_MAX_HEIGHT = 120;

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
  /** Ref to the underlying field, for imperative `.focus()` / `.blur()`. */
  inputRef?: Ref<TextInput>;
  /** Multiline field that grows with its content up to `maxAutoGrowHeight`,
   * then scrolls. Keeps a long comment fully visible while it is being typed. */
  autoGrow?: boolean;
  /** Ceiling for `autoGrow`, in px. Past it the field scrolls instead of growing. */
  maxAutoGrowHeight?: number;
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
  inputRef,
  autoGrow = false,
  maxAutoGrowHeight = AUTO_GROW_MAX_HEIGHT,
  ...rest
}: InputProps) {
  // RN does not resize a multiline field to fit its text, so the height is
  // driven from the reported content size and clamped at both ends: one line at
  // rest, `maxAutoGrowHeight` before it starts scrolling instead of growing.
  const [contentHeight, setContentHeight] = useState(0);
  const grownHeight = Math.min(Math.max(contentHeight, AUTO_GROW_MIN_HEIGHT), maxAutoGrowHeight);
  const autoGrowProps = autoGrow
    ? ({
        multiline: true,
        scrollEnabled: contentHeight > maxAutoGrowHeight,
        onContentSizeChange: (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) =>
          setContentHeight(e.nativeEvent.contentSize.height),
      } as const)
    : null;
  const heightStyle = autoGrow ? { height: grownHeight } : null;
  return (
    <VStack gap={1}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <View
        className={`flex-row ${autoGrow ? 'items-end' : 'items-center'} border ${
          pill ? 'rounded-full px-4 gap-2 py-2' : `rounded-md px-3 bg-surface ${dense ? 'py-1' : 'py-2'}`
        } ${error ? 'border-danger' : pill ? 'border-accent' : 'border-subtle'}`}
      >
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
          placeholderTextColor={pill ? colors.light.fg.accent : undefined}
          className={`flex-1 text-body ${pill ? 'text-accent' : 'text-primary'}`}
          textAlignVertical={rest.multiline || autoGrow ? 'top' : 'center'}
          // The visible box height is dominated by the field's own intrinsic
          // padding (large on Android) + font padding, NOT the wrapper's py-*.
          // In dense/pill mode we zero both so the wrapper padding alone sets height.
          style={
            dense || pill || autoGrow
              ? { ...(dense || pill ? { paddingVertical: 0, includeFontPadding: false } : {}), ...heightStyle }
              : undefined
          }
          {...autoGrowProps}
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
