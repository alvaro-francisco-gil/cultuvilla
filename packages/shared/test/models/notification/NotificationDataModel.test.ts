import { describe, it, expect } from 'vitest';
import {
  NotificationDataSchema,
  buildNotificationData,
} from '../../../src/models/notification/NotificationDataModel';

describe('NotificationDataSchema', () => {
  it('accepts a waitlist_promoted notification', () => {
    const parsed = NotificationDataSchema.parse({
      type: 'waitlist_promoted',
      title: 'Has subido del waitlist',
      body: 'Confirmado.',
      eventId: 'ev1',
      municipalityId: 'mun1',
      requesterUid: null,
      read: false,
      createdAt: new Date(),
    });
    expect(parsed.type).toBe('waitlist_promoted');
  });

  it('accepts an organizer_request_created notification with requesterUid', () => {
    const parsed = NotificationDataSchema.parse({
      type: 'organizer_request_created',
      title: 'Nueva solicitud',
      body: 'Solicitud entrante.',
      eventId: null,
      municipalityId: 'mun1',
      requesterUid: 'user-42',
      read: false,
      createdAt: new Date(),
    });
    expect(parsed.type).toBe('organizer_request_created');
    expect(parsed.requesterUid).toBe('user-42');
  });

  it('rejects when title is missing', () => {
    expect(() =>
      NotificationDataSchema.parse({
        type: 'waitlist_promoted',
        // title missing
        body: 'body',
        eventId: null,
        municipalityId: null,
        read: false,
        createdAt: new Date(),
      }),
    ).toThrow();
  });

  it('rejects an unknown notification type', () => {
    expect(() =>
      NotificationDataSchema.parse({
        type: 'something_else',
        title: 't',
        body: 'b',
        eventId: null,
        municipalityId: null,
        read: false,
        createdAt: new Date(),
      }),
    ).toThrow();
  });
});

describe('buildNotificationData', () => {
  it('defaults eventId, municipalityId, requesterUid to null and read to false', () => {
    const n = buildNotificationData({
      type: 'waitlist_promoted',
      title: 'Has subido del waitlist',
      body: 'Estás confirmado en el evento.',
    });
    expect(n.eventId).toBeNull();
    expect(n.municipalityId).toBeNull();
    expect(n.requesterUid).toBeNull();
    expect(n.read).toBe(false);
    expect(n.createdAt).toBeInstanceOf(Date);
  });

  it('preserves all provided fields', () => {
    const created = new Date('2026-04-01T10:00:00Z');
    const n = buildNotificationData({
      type: 'organizer_request_created',
      title: 'Nueva solicitud de organizador',
      body: 'X quiere organizar Y.',
      municipalityId: 'mun1',
      requesterUid: 'requester-1',
      read: true,
      createdAt: created,
    });
    expect(n.type).toBe('organizer_request_created');
    expect(n.municipalityId).toBe('mun1');
    expect(n.requesterUid).toBe('requester-1');
    expect(n.read).toBe(true);
    expect(n.createdAt).toEqual(created);
  });
});
