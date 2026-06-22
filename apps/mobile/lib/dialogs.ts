import { Alert, Platform } from 'react-native';

// `react-native-web@0.21` ships `Alert.alert` as a no-op, so info/confirm
// dialogs silently vanish on the Firebase Hosting web build. These helpers
// branch on Platform.OS and fall back to window.alert / window.confirm on web.
// See .claude/skills/mobile-web-compat/SKILL.md.

/** Single-button info dialog. Web → window.alert; native → Alert.alert. */
export function showAlert(message: string, title?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(title ? `${title}\n\n${message}` : message);
    }
    return;
  }
  if (title) {
    Alert.alert(title, message);
  } else {
    // mobile-web-compat: native-only — web returns above via window.alert.
    Alert.alert(message);
  }
}

/**
 * Confirm dialog. Calls `onConfirm` only if the user accepts. Web →
 * window.confirm; native → two-button Alert.alert.
 */
export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  { confirmText = 'OK', cancelText = 'Cancelar' }: { confirmText?: string; cancelText?: string } = {},
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, onPress: onConfirm },
  ]);
}
