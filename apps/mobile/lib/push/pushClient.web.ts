import type { DeviceTokenDataInput, NotificationCategory } from '@cultuvilla/shared/models/notification';

/**
 * Web twin of pushClient.ts. Push is native-only by decision (see
 * docs/plans/ongoing/device-notifications.md), and importing expo-notifications
 * into the web export is exactly the kind of native-module leak that has
 * crashed it before — so this file shadows the native one and never imports it.
 */
export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export const isPushSupported = false;

export function configureForegroundPresentation(): void {}

export async function ensureAndroidChannels(
  _names: Record<NotificationCategory, string>,
): Promise<void> {}

export async function getPushPermission(): Promise<PushPermission> {
  return 'unsupported';
}

export async function requestPushPermission(): Promise<PushPermission> {
  return 'unsupported';
}

export async function getPushRegistration(): Promise<DeviceTokenDataInput | null> {
  return null;
}

export function onPushTokenRefresh(_listener: () => void): () => void {
  return () => {};
}

export type PushTapData = Record<string, unknown>;

export function onPushTap(_listener: (data: PushTapData) => void): () => void {
  return () => {};
}

export function consumeLaunchTap(): PushTapData | null {
  return null;
}

export async function setAppBadge(_count: number): Promise<void> {}

export async function openPushSettings(): Promise<void> {}
