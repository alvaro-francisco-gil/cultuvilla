import { describe, it, expect } from 'vitest';
import { buildModerationEventData, ModerationEventDataSchema } from '../../src/models/moderation';

describe('moderationEvent model', () => {
  it('builds a hide event', () => {
    const e = buildModerationEventData({
      municipalityId: 'm1',
      collection: 'news',
      docId: 'n1',
      action: 'hide',
      actorUserId: 'admin1',
      reason: 'spam',
      createdAt: new Date(0),
    });
    expect(ModerationEventDataSchema.parse(e).action).toBe('hide');
  });

  it('rejects an out-of-scope collection', () => {
    expect(() =>
      ModerationEventDataSchema.parse({
        municipalityId: 'm1',
        collection: 'organizations',
        docId: 'o1',
        action: 'hide',
        actorUserId: 'a',
        reason: null,
        createdAt: new Date(0),
      })
    ).toThrow();
  });
});
