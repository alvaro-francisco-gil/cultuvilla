import AsyncStorage from '@react-native-async-storage/async-storage';

// Preserves a deep-link destination (e.g. an invite URL tapped while signed
// out) across the sign-in flow, regardless of which auth method completes it.
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
