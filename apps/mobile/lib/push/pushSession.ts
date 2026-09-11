import { unregisterDevice } from '@cultuvilla/shared/services/notificationService';

/**
 * The token this install registered for the signed-in account.
 *
 * Module state rather than context because the one consumer, sign-out, runs in
 * AuthContext — which sits ABOVE PushProvider and so cannot read its context.
 */
let registered: { uid: string; token: string } | null = null;

export function rememberRegisteredToken(uid: string, token: string): void {
  registered = { uid, token };
}

/**
 * Deletes this device's row for the account that is signing out. Must run
 * BEFORE the Firebase sign-out: the rules only let the owner delete it, and a
 * shared phone must stop receiving the previous villager's seat news.
 */
export async function unregisterPushForSignOut(): Promise<void> {
  const current = registered;
  registered = null;
  if (!current) return;
  try {
    await unregisterDevice(current.uid, current.token);
  } catch {
    // Signing out must never fail on push cleanup. A leftover row is pruned the
    // first time the platform reports the token dead.
  }
}
