import type { NotificationData } from './NotificationDataModel';
import { notificationCategory, type NotificationCategory } from './NotificationCategory';
import { notificationRoute } from './NotificationRoute';

/**
 * The platform-neutral description of one push, and its translation to each
 * platform's native wire format.
 *
 * This file is the ONLY place where Android and iOS differ in *behaviour*.
 * Everything upstream — the triggers, the queue, the preference check — deals
 * in notification docs; everything downstream is a thin transport that sends
 * whatever these builders produced. If a screen or a handler ever branches on
 * the platform to decide how a notification behaves, the branch belongs here.
 *
 * Two transports, not one, because the two platforms hand out incompatible
 * tokens: `expo-notifications` returns an FCM token on Android and a raw APNs
 * token on iOS, and FCM cannot deliver to the latter. See DeviceTokenDataModel.
 *
 * The builders are typed structurally rather than against firebase-admin or an
 * APNs library, so the whole Android/iOS contract is asserted from the fast
 * vitest suite instead of only under emulators.
 */
export interface PushEnvelope {
  title: string;
  body: string;
  category: NotificationCategory;
  /**
   * Repeat suppression. Same type + same subject replaces rather than stacks —
   * an organizer who edits an event five times produces one notification on the
   * device, not five. Different types about the same subject never collapse
   * into each other, so a cancellation can never be swallowed by an update.
   */
  collapseKey: string;
  /** Groups every notification about one subject into a single OS thread. */
  threadId: string;
  /** The route a tap should open; null means "just open the Buzón". */
  route: string | null;
  /** Delivered alongside the alert so the tap handler can route without a read. */
  data: Record<string, string>;
}

const URGENT: NotificationCategory = 'mine';

function subjectOf(n: NotificationData): string {
  if (n.eventId) return `event:${n.eventId}`;
  if (n.entityKind && n.entityId) return `${n.entityKind}:${n.entityId}`;
  if (n.municipalityId) return `village:${n.municipalityId}`;
  return `type:${n.type}`;
}

export function buildPushEnvelope(
  notificationId: string,
  n: NotificationData,
): PushEnvelope {
  const category = notificationCategory(n.type);
  const subject = subjectOf(n);
  const route = notificationRoute(n);

  // FCM data values must be strings, and a null becomes an absent key rather
  // than the string "null" — the tap handler checks presence, not content.
  const data: Record<string, string> = {
    notificationId,
    type: n.type,
    category,
  };
  if (route) data['route'] = route;
  if (n.eventId) data['eventId'] = n.eventId;
  if (n.entityKind) data['entityKind'] = n.entityKind;
  if (n.entityId) data['entityId'] = n.entityId;
  if (n.municipalityId) data['municipalityId'] = n.municipalityId;

  return {
    title: n.title,
    body: n.body,
    category,
    collapseKey: `${n.type}:${subject}`,
    threadId: subject,
    route,
    data,
  };
}

// ── Android: FCM HTTP v1 (structural; firebase-admin's MulticastMessage) ────

export interface FcmAndroidMulticastMessage {
  tokens: string[];
  notification: { title: string; body: string };
  data: Record<string, string>;
  android: {
    collapseKey: string;
    priority: 'high' | 'normal';
    /** Milliseconds the push stays deliverable while the device is offline. */
    ttl: number;
    notification: {
      // The channel id IS the category id — see NotificationCategory.ts.
      channelId: string;
      /** Android's replace-in-place key: one subject owns one row in the shade. */
      tag: string;
      sound: string;
      /** Android's own importance hint, separate from the transport priority. */
      priority: 'high' | 'default';
      defaultVibrateTimings: boolean;
    };
  };
}

// ── iOS: APNs HTTP/2 ─────────────────────────────────────────────────────────

export interface ApnsNotification {
  /** Request headers other than `authorization` and `apns-topic`, which the transport owns. */
  headers: {
    'apns-push-type': 'alert';
    'apns-priority': '10' | '5';
    'apns-collapse-id': string;
    'apns-expiration': string;
  };
  payload: {
    aps: {
      alert: { title: string; body: string };
      sound: string;
      'thread-id': string;
      'interruption-level': 'time-sensitive' | 'active';
      badge?: number;
    };
    /** Custom keys ride at the top level beside `aps`, where expo-notifications reads them. */
    [key: string]: unknown;
  };
}

export interface PushWireOptions {
  /** Unread count to stamp on the iOS app icon. Android badges via the launcher. */
  badge?: number;
  /** Seconds the push stays deliverable while the device is offline. */
  ttlSeconds?: number;
  /** Injected for tests; the APNs expiration is an absolute timestamp. */
  now?: Date;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

/** APNs rejects a collapse id over 64 bytes; FCM's limit is far higher. */
const APNS_COLLAPSE_ID_MAX_BYTES = 64;

function truncateUtf8(value: string, maxBytes: number): string {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length <= maxBytes) return value;
  return new TextDecoder().decode(bytes.slice(0, maxBytes)).replace(/\uFFFD+$/, '');
}

export function toFcmAndroidMessage(
  envelope: PushEnvelope,
  tokens: string[],
  options: PushWireOptions = {},
): FcmAndroidMulticastMessage {
  const urgent = envelope.category === URGENT;
  return {
    tokens,
    notification: { title: envelope.title, body: envelope.body },
    data: envelope.data,
    android: {
      collapseKey: envelope.collapseKey,
      // `high` wakes a dozing device immediately; Android penalises apps that
      // send high priority for things the user does not act on, so broadcast
      // stays `normal`.
      priority: urgent ? 'high' : 'normal',
      ttl: (options.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000,
      notification: {
        channelId: envelope.category,
        tag: envelope.threadId,
        sound: 'default',
        priority: urgent ? 'high' : 'default',
        defaultVibrateTimings: urgent,
      },
    },
  };
}

export function toApnsNotification(
  envelope: PushEnvelope,
  options: PushWireOptions = {},
): ApnsNotification {
  const urgent = envelope.category === URGENT;
  const now = options.now ?? new Date();
  const ttl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  return {
    headers: {
      'apns-push-type': 'alert',
      // 10 = deliver now, 5 = may be batched to save power.
      'apns-priority': urgent ? '10' : '5',
      'apns-collapse-id': truncateUtf8(envelope.collapseKey, APNS_COLLAPSE_ID_MAX_BYTES),
      'apns-expiration': String(Math.floor(now.getTime() / 1000) + ttl),
    },
    payload: {
      aps: {
        alert: { title: envelope.title, body: envelope.body },
        sound: 'default',
        'thread-id': envelope.threadId,
        // `time-sensitive` breaks through Focus modes and needs the
        // com.apple.developer.usernotifications.time-sensitive entitlement
        // (app.config.ts). Without it iOS silently downgrades to `active` —
        // which is why this is easy to ship broken and never notice.
        'interruption-level': urgent ? 'time-sensitive' : 'active',
        ...(options.badge === undefined ? {} : { badge: options.badge }),
      },
      ...envelope.data,
    },
  };
}
