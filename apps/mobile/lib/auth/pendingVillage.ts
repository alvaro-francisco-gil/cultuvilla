import AsyncStorage from '@react-native-async-storage/async-storage';

// Sibling of pendingIntent: the municipality a logged-out user tapped "sign in
// to join" on, carried across the auth boundary so onboarding's VillagePicker
// pre-selects it (and then joins it). Persisted only on register-commit — see
// RegisterGateContext — so dismissing the prompt leaves no stale selection.
const PENDING_VILLAGE_KEY = 'cultuvilla.pendingVillage';

export async function setPendingVillage(municipalityId: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_VILLAGE_KEY, municipalityId);
}

export async function readPendingVillage(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_VILLAGE_KEY);
}

export async function clearPendingVillage(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_VILLAGE_KEY);
}
