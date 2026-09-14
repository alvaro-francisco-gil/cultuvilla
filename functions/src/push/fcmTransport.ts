import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import type { FcmAndroidMulticastMessage } from '@cultuvilla/shared/models';
import type { TransportResult } from './transport';

/** FCM error codes that mean "this token will never work again". */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** FCM's hard cap on tokens per multicast. */
const MULTICAST_LIMIT = 500;

export async function sendFcmAndroid(message: FcmAndroidMulticastMessage): Promise<TransportResult> {
  if (message.tokens.length === 0) return { delivered: 0, failed: 0, deadTokens: [] };

  let delivered = 0;
  let failed = 0;
  const deadTokens: string[] = [];

  for (let i = 0; i < message.tokens.length; i += MULTICAST_LIMIT) {
    const tokens = message.tokens.slice(i, i + MULTICAST_LIMIT);
    // The shared builder is typed structurally; this annotation is the
    // compile-time proof it still satisfies the SDK. If either side drifts,
    // this line stops compiling instead of a push silently failing.
    const fcm: MulticastMessage = { ...message, tokens };
    const response = await getMessaging().sendEachForMulticast(fcm);
    delivered += response.successCount;
    failed += response.failureCount;
    response.responses.forEach((r, j) => {
      const token = tokens[j];
      if (!r.success && token && DEAD_TOKEN_CODES.has(r.error?.code ?? '')) {
        deadTokens.push(token);
      }
    });
  }

  return { delivered, failed, deadTokens };
}
