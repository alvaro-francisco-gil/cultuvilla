import { z } from 'zod';
import { NOTIFICATION_CATEGORIES } from './NotificationCategory';

/**
 * One push, enqueued at `pushQueue/{userId}__{notificationId}`.
 *
 * The deterministic id does the real work here, and it does two jobs at once:
 *
 * 1. **At-least-once guard.** Eventarc redelivers, so `onNotificationCreated`
 *    can fire twice for one notification. The enqueue is a `create`, which
 *    fails if the doc exists — so a redelivery is a no-op instead of a second
 *    buzz in someone's pocket.
 * 2. **Deferral.** A broadcast that lands overnight carries a `sendAfter` in
 *    the morning and is picked up by `flushPushQueue`, rather than being held
 *    in memory or re-derived from the notification log (which would need a
 *    collection-group query across every user).
 *
 * Server-only: `firestore.rules` denies clients both directions. Nothing in the
 * app ever reads it.
 */
export const PushQueueDataSchema = z.object({
  userId: z.string(),
  notificationId: z.string(),
  category: z.enum(NOTIFICATION_CATEGORIES),
  /** The instant this may leave; `<= now` means due. */
  sendAfter: z.date(),
  createdAt: z.date(),
  /** Null until a send attempt resolves — the flush query keys off this. */
  sentAt: z.date().nullable(),
  /** Tokens FCM accepted, for triage. Zero is normal (user has no devices). */
  deliveredCount: z.number(),
  /** Tokens FCM rejected; the dead ones are pruned at the same time. */
  failedCount: z.number(),
});
export type PushQueueData = z.infer<typeof PushQueueDataSchema>;

export interface PushQueueDataInput {
  userId: string;
  notificationId: string;
  category: (typeof NOTIFICATION_CATEGORIES)[number];
  sendAfter: Date;
  createdAt?: Date;
  sentAt?: Date | null;
  deliveredCount?: number;
  failedCount?: number;
}

export function buildPushQueueData(input: PushQueueDataInput): PushQueueData {
  return {
    userId: input.userId,
    notificationId: input.notificationId,
    category: input.category,
    sendAfter: input.sendAfter,
    createdAt: input.createdAt ?? new Date(),
    sentAt: input.sentAt ?? null,
    deliveredCount: input.deliveredCount ?? 0,
    failedCount: input.failedCount ?? 0,
  };
}

/** The doc id for one user's copy of one notification. */
export function pushQueueId(userId: string, notificationId: string): string {
  return `${userId}__${notificationId}`;
}
