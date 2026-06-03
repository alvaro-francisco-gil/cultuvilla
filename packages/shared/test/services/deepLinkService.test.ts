import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { deepLinkHost: 'example.test.app' } } },
}));

import {
  getEventLink,
  getNewsLink,
  getVillageInviteLink,
  getOrgInviteLink,
  parseLink,
  buildShareMessage,
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

describe('deepLinkService.parseLink', () => {
  it('parses an event https URL', () => {
    expect(parseLink('https://example.test.app/event/evt_123')).toEqual({
      kind: 'content',
      resource: 'event',
      id: 'evt_123',
    });
  });

  it('parses a news https URL', () => {
    expect(parseLink('https://example.test.app/news/news_42')).toEqual({
      kind: 'content',
      resource: 'news',
      id: 'news_42',
    });
  });

  it('parses a village invite https URL', () => {
    expect(parseLink('https://example.test.app/village/mun_abc')).toEqual({
      kind: 'invite',
      resource: 'village',
      id: 'mun_abc',
    });
  });

  it('parses an org invite https URL using /o/', () => {
    expect(parseLink('https://example.test.app/o/org_xyz')).toEqual({
      kind: 'invite',
      resource: 'organization',
      id: 'org_xyz',
    });
  });

  it('parses a cultuvilla:// scheme URL', () => {
    expect(parseLink('cultuvilla://event/evt_123')).toEqual({
      kind: 'content',
      resource: 'event',
      id: 'evt_123',
    });
  });

  it('returns null for a host mismatch', () => {
    expect(parseLink('https://other.host/event/evt_123')).toBeNull();
  });

  it('returns null for an unknown resource segment', () => {
    expect(parseLink('https://example.test.app/profile/user_1')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(parseLink('not-a-url')).toBeNull();
  });

  it('round-trips a generated link', () => {
    const link = getEventLink('evt_round');
    expect(parseLink(link.url)).toEqual({
      kind: 'content',
      resource: 'event',
      id: 'evt_round',
    });
  });
});

describe('deepLinkService.buildShareMessage', () => {
  const t = (key: string, vars?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      'deeplink.share.event': 'Te invito a este evento: {url}',
      'deeplink.share.news': 'Mira esta noticia: {url}',
      'deeplink.share.village': 'Te invito a este pueblo: {url}',
      'deeplink.share.organization': 'Te invito a esta organización: {url}',
    };
    let out = map[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };

  it('produces an event share message', () => {
    const link = getEventLink('evt_1');
    expect(buildShareMessage(link, t)).toBe(`Te invito a este evento: ${link.url}`);
  });

  it('produces a village share message', () => {
    const link = getVillageInviteLink('mun_1');
    expect(buildShareMessage(link, t)).toBe(`Te invito a este pueblo: ${link.url}`);
  });

  it('produces an organization share message', () => {
    const link = getOrgInviteLink('org_1');
    expect(buildShareMessage(link, t)).toBe(`Te invito a esta organización: ${link.url}`);
  });
});
