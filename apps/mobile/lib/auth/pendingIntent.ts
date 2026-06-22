import AsyncStorage from '@react-native-async-storage/async-storage';

// Mirrors PENDING_EMAIL_KEY in AuthContext.tsx — same cross-session storage,
// so an intent set before an email-link flow survives a tab/session change.
const PENDING_INTENT_KEY = 'cultuvilla.pendingIntent';

export async function setPendingIntent(href: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_INTENT_KEY, href);
}

export async function readPendingIntent(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_INTENT_KEY);
}

export async function clearPendingIntent(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_INTENT_KEY);
}
