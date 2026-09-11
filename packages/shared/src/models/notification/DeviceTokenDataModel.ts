import { z } from 'zod';

/**
 * One push-capable device belonging to one account, stored at
 * `users/{uid}/devices/{token}`.
 *
 * **The doc id IS the FCM registration token.** That makes re-registration
 * idempotent by construction — the same device on the same install writes the
 * same doc every launch instead of accumulating a row per session — and it
 * makes the "this token is dead" cleanup a plain delete of a known path when
 * FCM answers `registration-token-not-registered`.
 *
 * Tokens are scoped to an account, not to a device: they are written on
 * sign-in and deleted on sign-out, so a shared phone never keeps pushing one
 * villager's seat news to whoever signs in next.
 */
export const DevicePlatformSchema = z.enum(['ios', 'android']);
export type DevicePlatform = z.infer<typeof DevicePlatformSchema>;

/**
 * Which APNs gateway an iOS token belongs to. A token minted by a development
 * build is only valid against the sandbox, and one from a TestFlight/App Store
 * build only against production — sending to the wrong one answers
 * `BadDeviceToken`, indistinguishable from a dead token. So the environment has
 * to travel with the token; the server cannot infer it.
 */
export const ApnsEnvironmentSchema = z.enum(['production', 'sandbox']);
export type ApnsEnvironment = z.infer<typeof ApnsEnvironmentSchema>;

/**
 * **The platform decides the transport, and the token's shape follows it.**
 * `expo-notifications` hands back an FCM registration token on Android but a
 * raw APNs device token on iOS. FCM cannot deliver to a raw APNs token, so iOS
 * goes to APNs directly — see functions/src/push/. That is why the iOS-only
 * fields exist and why they are null on Android rather than optional: the rule
 * and the converter both assert the pairing.
 */
export const DeviceTokenDataSchema = z
  .object({
    token: z.string(),
    platform: DevicePlatformSchema,
    /** iOS only: which APNs gateway accepts this token. */
    apnsEnvironment: ApnsEnvironmentSchema.nullable(),
    /** iOS only: the bundle id, which APNs requires as the `apns-topic`. */
    apnsTopic: z.string().nullable(),
    /** Marketing version of the app that registered this token, for triage. */
    appVersion: z.string(),
    createdAt: z.date(),
    /** Refreshed on every registration; the sweep for stale devices reads this. */
    lastSeenAt: z.date(),
  })
  .refine(
    (d) =>
      d.platform === 'ios'
        ? d.apnsEnvironment !== null && d.apnsTopic !== null
        : d.apnsEnvironment === null && d.apnsTopic === null,
    { message: 'apnsEnvironment/apnsTopic are required on iOS and must be null on Android' },
  );
export type DeviceTokenData = z.infer<typeof DeviceTokenDataSchema>;

export interface DeviceTokenDataInput {
  token: string;
  platform: DevicePlatform;
  apnsEnvironment?: ApnsEnvironment | null;
  apnsTopic?: string | null;
  appVersion: string;
  createdAt?: Date;
  lastSeenAt?: Date;
}

export function buildDeviceTokenData(input: DeviceTokenDataInput): DeviceTokenData {
  const now = new Date();
  return {
    token: input.token,
    platform: input.platform,
    apnsEnvironment: input.platform === 'ios' ? (input.apnsEnvironment ?? null) : null,
    apnsTopic: input.platform === 'ios' ? (input.apnsTopic ?? null) : null,
    appVersion: input.appVersion,
    createdAt: input.createdAt ?? now,
    lastSeenAt: input.lastSeenAt ?? now,
  };
}
