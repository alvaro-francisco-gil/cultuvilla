import { describe, it, expect } from 'vitest';
import { NotificationTypeSchema } from '../../../src/models/notification/NotificationDataModel';
import {
  ANDROID_CHANNELS,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY,
  notificationCategory,
} from '../../../src/models/notification/NotificationCategory';

describe('notification categories', () => {
  it('maps every notification type to a category', () => {
    for (const type of NotificationTypeSchema.options) {
      expect(NOTIFICATION_CATEGORIES).toContain(notificationCategory(type));
    }
    expect(Object.keys(NOTIFICATION_CATEGORY).sort()).toEqual(
      [...NotificationTypeSchema.options].sort(),
    );
  });

  it('gives every category exactly one Android channel whose id IS the category', () => {
    // The server sends `channelId: category`; the client creates channels from
    // ANDROID_CHANNELS. If these ever differ, Android drops the push silently.
    for (const category of NOTIFICATION_CATEGORIES) {
      expect(ANDROID_CHANNELS[category].id).toBe(category);
    }
    expect(Object.keys(ANDROID_CHANNELS).sort()).toEqual([...NOTIFICATION_CATEGORIES].sort());
  });

  it('keeps anything about the user’s own seat in the urgent bucket', () => {
    for (const type of [
      'waitlist_promoted',
      'event_cancelled',
      'event_updated',
      'signups_disabled',
      'registration_removed',
      'event_reminder',
    ] as const) {
      expect(notificationCategory(type)).toBe('mine');
    }
  });

  it('files the village broadcast under village and replies under social', () => {
    expect(notificationCategory('village_entity_published')).toBe('village');
    expect(notificationCategory('comment_reply')).toBe('social');
  });

  it('only the urgent channel vibrates at high importance', () => {
    expect(ANDROID_CHANNELS.mine).toMatchObject({ importance: 'high', vibrate: true });
    expect(ANDROID_CHANNELS.village).toMatchObject({ importance: 'default', vibrate: false });
    expect(ANDROID_CHANNELS.social).toMatchObject({ importance: 'default', vibrate: false });
  });
});
