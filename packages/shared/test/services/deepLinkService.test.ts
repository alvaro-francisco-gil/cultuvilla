import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { deepLinkHost: 'example.test.app' } } },
}));

import {
  getEventLink,
  getNewsLink,
  getVillageInviteLink,
  getOrgInviteLink,
} from '../../src/services/deepLinkService';

describe('deepLinkService builders', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('builds an event content link', () => {
    expect(getEventLink('evt_123')).toEqual({
      url: 'https://example.test.app/event/evt_123',
      kind: 'content',
      resource: 'event',
      id: 'evt_123',
    });
  });

  it('builds a news content link', () => {
    expect(getNewsLink('news_42')).toEqual({
      url: 'https://example.test.app/news/news_42',
      kind: 'content',
      resource: 'news',
      id: 'news_42',
    });
  });

  it('builds a village invite link', () => {
    expect(getVillageInviteLink('mun_abc')).toEqual({
      url: 'https://example.test.app/village/mun_abc',
      kind: 'invite',
      resource: 'village',
      id: 'mun_abc',
    });
  });

  it('builds an organization invite link using the /o/ short segment', () => {
    expect(getOrgInviteLink('org_xyz')).toEqual({
      url: 'https://example.test.app/o/org_xyz',
      kind: 'invite',
      resource: 'organization',
      id: 'org_xyz',
    });
  });

  it('throws on empty id', () => {
    expect(() => getEventLink('')).toThrow(/id/i);
  });
});
