import { describe, it, expect } from 'vitest';
import { buildNotificationData, type NotificationData } from '../../../src/models/notification/NotificationDataModel';
import {
  buildPushEnvelope,
  toApnsNotification,
  toFcmAndroidMessage,
} from '../../../src/models/notification/PushEnvelope';

function notif(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    ...buildNotificationData({ type: 'event_cancelled', title: 'Evento cancelado', body: 'x' }),
    ...overrides,
  };
}

describe('buildPushEnvelope', () => {
  it('carries only string data values and omits absent ids instead of sending "null"', () => {
    const env = buildPushEnvelope('n1', notif({ eventId: 'ev1', municipalityId: null }), 'villa');
    for (const v of Object.values(env.data)) expect(typeof v).toBe('string');
    expect(env.data).toMatchObject({ notificationId: 'n1', type: 'event_cancelled', eventId: 'ev1', route: '/villa/evento/_ev1' });
    expect(env.data).not.toHaveProperty('municipalityId');
    expect(env.data).not.toHaveProperty('entityId');
  });

  it('threads by subject and collapses by type + subject', () => {
    const updated = buildPushEnvelope('a', notif({ type: 'event_updated', eventId: 'ev1' }), 'villa');
    const cancelled = buildPushEnvelope('b', notif({ type: 'event_cancelled', eventId: 'ev1' }), 'villa');
    expect(updated.threadId).toBe('event:ev1');
    expect(cancelled.threadId).toBe('event:ev1');
    // A cancellation must never be swallowed by an earlier update.
    expect(updated.collapseKey).not.toBe(cancelled.collapseKey);
  });

  it('collapses repeated edits of the same event into one', () => {
    const first = buildPushEnvelope('a', notif({ type: 'event_updated', eventId: 'ev1' }), 'villa');
    const second = buildPushEnvelope('b', notif({ type: 'event_updated', eventId: 'ev1' }), 'villa');
    expect(first.collapseKey).toBe(second.collapseKey);
  });

  it('omits the route when the pueblo is unknown, so the tap lands in the Buzón', () => {
    const env = buildPushEnvelope('n', notif({ eventId: 'ev1' }), null);
    expect(env.route).toBeNull();
    expect(env.data['route']).toBeUndefined();
  });

  it('threads a village broadcast by the entity it announces', () => {
    const env = buildPushEnvelope(
      'n',
      notif({ type: 'village_entity_published', entityKind: 'news', entityId: 'p1', municipalityId: 'm' }),
      'villa',
    );
    expect(env.threadId).toBe('news:p1');
    expect(env.category).toBe('village');
    expect(env.route).toBe('/villa/noticia/_p1');
  });
});

describe('toFcmAndroidMessage', () => {
  it('sends urgent pushes at high priority on the `mine` channel', () => {
    const msg = toFcmAndroidMessage(buildPushEnvelope('n', notif({ eventId: 'ev1' }), 'villa'), ['t1']);
    expect(msg.tokens).toEqual(['t1']);
    expect(msg.android.priority).toBe('high');
    expect(msg.android.notification).toMatchObject({
      channelId: 'mine',
      priority: 'high',
      defaultVibrateTimings: true,
      tag: 'event:ev1',
    });
  });

  it('keeps broadcasts at normal priority on their own channel', () => {
    const msg = toFcmAndroidMessage(
      buildPushEnvelope('n', notif({ type: 'village_entity_published', entityKind: 'event', entityId: 'e' }), 'villa'),
      ['t1'],
    );
    expect(msg.android.priority).toBe('normal');
    expect(msg.android.notification.channelId).toBe('village');
    expect(msg.android.notification.defaultVibrateTimings).toBe(false);
  });

  it('expresses the TTL in milliseconds', () => {
    const msg = toFcmAndroidMessage(buildPushEnvelope('n', notif(), 'villa'), ['t'], { ttlSeconds: 60 });
    expect(msg.android.ttl).toBe(60_000);
  });
});

describe('toApnsNotification', () => {
  const now = new Date('2026-09-10T10:00:00Z');

  it('marks urgent pushes time-sensitive at priority 10', () => {
    const apns = toApnsNotification(buildPushEnvelope('n', notif({ eventId: 'ev1' }), 'villa'), { now });
    expect(apns.headers['apns-priority']).toBe('10');
    expect(apns.headers['apns-push-type']).toBe('alert');
    expect(apns.payload.aps['interruption-level']).toBe('time-sensitive');
    expect(apns.payload.aps['thread-id']).toBe('event:ev1');
  });

  it('lets broadcasts be batched: active, priority 5', () => {
    const apns = toApnsNotification(
      buildPushEnvelope('n', notif({ type: 'village_entity_published', entityKind: 'place', entityId: 'p', municipalityId: 'm' }), 'villa'),
      { now },
    );
    expect(apns.headers['apns-priority']).toBe('5');
    expect(apns.payload.aps['interruption-level']).toBe('active');
  });

  it('puts routing data beside `aps`, where the client reads it', () => {
    const apns = toApnsNotification(buildPushEnvelope('n1', notif({ eventId: 'ev1' }), 'villa'), { now });
    expect(apns.payload['notificationId']).toBe('n1');
    expect(apns.payload['route']).toBe('/villa/evento/_ev1');
  });

  it('stamps the badge only when one is given', () => {
    const env = buildPushEnvelope('n', notif(), 'villa');
    expect(toApnsNotification(env, { now }).payload.aps).not.toHaveProperty('badge');
    expect(toApnsNotification(env, { now, badge: 3 }).payload.aps.badge).toBe(3);
  });

  it('derives an absolute expiration from now + ttl', () => {
    const apns = toApnsNotification(buildPushEnvelope('n', notif(), 'villa'), { now, ttlSeconds: 100 });
    expect(apns.headers['apns-expiration']).toBe(String(now.getTime() / 1000 + 100));
  });

  it('truncates the collapse id to the 64 bytes APNs accepts', () => {
    const long = 'x'.repeat(80);
    const apns = toApnsNotification(
      buildPushEnvelope('n', notif({ type: 'village_entity_published', entityKind: 'news', entityId: long }), 'villa'),
      { now },
    );
    expect(new TextEncoder().encode(apns.headers['apns-collapse-id']).length).toBeLessThanOrEqual(64);
  });

  it('never splits a multi-byte character when truncating', () => {
    const accented = 'ñ'.repeat(40); // 2 bytes each
    const apns = toApnsNotification(
      buildPushEnvelope('n', notif({ type: 'village_entity_published', entityKind: 'news', entityId: accented }), 'villa'),
      { now },
    );
    expect(apns.headers['apns-collapse-id']).not.toContain('�');
  });
});
