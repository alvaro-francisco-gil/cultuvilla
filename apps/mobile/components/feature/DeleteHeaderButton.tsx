import { Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from '../primitives/Pressable';
import { colors, iconSizes } from '@cultuvilla/shared/design-system';

export type DeleteHeaderButtonProps = {
  onConfirm: () => void;
  accessibilityLabel: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Rendered inside an orange `ScreenHeader accent` bar → use the light tint. */
  onAccent?: boolean;
};

/**
 * Trash icon for an edit screen's `ScreenHeader` rightSlot. Runs a confirm
 * dialog before invoking `onConfirm`. This is the ONE place delete lives for an
 * entity — never in the entity detail header.
 */
export function DeleteHeaderButton({
  onConfirm,
  accessibilityLabel,
  confirmTitle,
  confirmMessage,
  confirmLabel,
  cancelLabel,
  onAccent = false,
}: DeleteHeaderButtonProps) {
  // Alert.alert is a no-op on RN-Web, so branch to window.confirm there.
  const run = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) onConfirm();
      return;
    }
    Alert.alert(confirmTitle, confirmMessage, [
      { text: cancelLabel, style: 'cancel' },
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
    ]);
  };
  return (
    <Pressable onPress={run} accessibilityLabel={accessibilityLabel} className="p-1 ml-2">
      <Ionicons
        name="trash-outline"
        size={iconSizes.md}
        color={onAccent ? '#f9f0e8' : colors.light.fg.accent}
      />
    </Pressable>
  );
}
