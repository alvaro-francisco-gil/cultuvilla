import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_SOFT_ASK_STATE, type SoftAskState } from './softAskPolicy';

// Per install, not per account: the thing being rationed is the OS dialog,
// which is also per install.
const KEY = 'push.softAsk.v1';

export async function loadSoftAskState(): Promise<SoftAskState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return INITIAL_SOFT_ASK_STATE;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'askCount' in parsed &&
      typeof parsed.askCount === 'number' &&
      'lastAskedAt' in parsed &&
      (parsed.lastAskedAt === null || typeof parsed.lastAskedAt === 'number')
    ) {
      return { askCount: parsed.askCount, lastAskedAt: parsed.lastAskedAt };
    }
    return INITIAL_SOFT_ASK_STATE;
  } catch {
    return INITIAL_SOFT_ASK_STATE;
  }
}

export async function saveSoftAskState(state: SoftAskState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}
