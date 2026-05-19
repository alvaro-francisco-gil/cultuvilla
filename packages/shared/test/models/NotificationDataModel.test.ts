import { describe, it, expect } from 'vitest';
import { buildNotificationData } from '../../src/models/notification/NotificationDataModel';

describe('buildNotificationData', () => {
  it('defaults eventId, municipalityId to null and read to false', () => {
    const n = buildNotificationData({
      type: 'waitlist_promoted',
      title: 'Has subido del waitlist',
      body: 'Estás confirmado en el evento.',
    });
    expect(n.eventId).toBeNull();
    expect(n.municipalityId).toBeNull();
    expect(n.read).toBe(false);
    expect(n.createdAt).toBeInstanceOf(Date);
  });

  it('preserves all provided fields', () => {
    const created = new Date('2026-04-01T10:00:00Z');
    const n = buildNotificationData({
      type: 'event_cancelled',
      title: 'Evento cancelado',
      body: 'La fiesta se ha cancelado.',
      eventId: 'ev1',
      municipalityId: 'v1',
      read: true,
      createdAt: created,
    });
    expect(n.type).toBe('event_cancelled');
    expect(n.eventId).toBe('ev1');
    expect(n.municipalityId).toBe('v1');
    expect(n.read).toBe(true);
    expect(n.createdAt).toEqual(created);
  });
});
