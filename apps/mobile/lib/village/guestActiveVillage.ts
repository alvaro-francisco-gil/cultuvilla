import AsyncStorage from '@react-native-async-storage/async-storage';

// The village a logged-out visitor is currently viewing via a share link. Set
// when a guest opens /village/[villageId] and used as the guest's "active
// village" so the tab shell (village tab + header) can render it. Persisted so
// it survives the redirect into the tab shell and a web reload within the
// guest session; cleared once a real user signs in (their profile takes over).
const GUEST_ACTIVE_VILLAGE_KEY = 'cultuvilla.guestActiveVillage';

export async function setGuestActiveVillage(municipalityId: string): Promise<void> {
  await AsyncStorage.setItem(GUEST_ACTIVE_VILLAGE_KEY, municipalityId);
}

export async function readGuestActiveVillage(): Promise<string | null> {
  return AsyncStorage.getItem(GUEST_ACTIVE_VILLAGE_KEY);
}

export async function clearGuestActiveVillage(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_ACTIVE_VILLAGE_KEY);
}
