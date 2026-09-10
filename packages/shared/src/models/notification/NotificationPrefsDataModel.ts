import { z } from 'zod';
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from './NotificationCategory';

/**
 * Per-account push preferences at `users/{uid}/preferences/notifications`.
 *
 * **The doc is optional.** An account that has never opened the notification
 * settings has no doc at all, and `DEFAULT_NOTIFICATION_PREFS` applies. That is
 * not a tolerated-stale-data shim: the document genuinely does not exist yet,
 * so there is nothing to backfill and no strict converter that can crash on an
 * account created before this feature.
 *
 * These gate PUSH only. The in-app Buzón always receives everything — muting a
 * category must not silently destroy the durable record of what happened.
 */
export const NotificationPrefsDataSchema = z.object({
  /** Seats, registrations and requests the user personally holds. */
  mine: z.boolean(),
  /** Anything new published in a village the user belongs to. */
  village: z.boolean(),
  /** Comment replies and organization/organizer outcomes. */
  social: z.boolean(),
  /**
   * Hold `village` and `social` pushes overnight (22:00–08:00 Europe/Madrid).
   * Never applies to `mine` — a released seat is worth a buzz at 23:00.
   */
  quietHours: z.boolean(),
  updatedAt: z.date(),
});
export type NotificationPrefsData = z.infer<typeof NotificationPrefsDataSchema>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefsData = {
  mine: true,
  village: true,
  social: true,
  quietHours: true,
  // A sentinel, not a real edit: this value is only ever seen for an account
  // with no stored doc, and nothing reads it except a debug view.
  updatedAt: new Date(0),
};

export interface NotificationPrefsDataInput {
  mine?: boolean;
  village?: boolean;
  social?: boolean;
  quietHours?: boolean;
  updatedAt?: Date;
}

export function buildNotificationPrefsData(
  input: NotificationPrefsDataInput = {},
): NotificationPrefsData {
  return {
    mine: input.mine ?? DEFAULT_NOTIFICATION_PREFS.mine,
    village: input.village ?? DEFAULT_NOTIFICATION_PREFS.village,
    social: input.social ?? DEFAULT_NOTIFICATION_PREFS.social,
    quietHours: input.quietHours ?? DEFAULT_NOTIFICATION_PREFS.quietHours,
    updatedAt: input.updatedAt ?? new Date(),
  };
}

/** Whether push for `category` is allowed under `prefs`. */
export function allowsPush(
  prefs: NotificationPrefsData,
  category: NotificationCategory,
): boolean {
  return prefs[category];
}

/** Exhaustiveness guard: every category must be a togglable preference key. */
export const NOTIFICATION_PREF_KEYS: readonly NotificationCategory[] = NOTIFICATION_CATEGORIES;
