import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { deepLinkHost: 'example.test.app' } } },
}));

import {
  getEventLink,
  getNewsLink,
  getVillageViewLink,
  getVillageInviteLink,
  getOrgViewLink,
  getOrgInviteLink,
  parseLink,
  buildShareMessage,
} from '../../src/services/deepLinkService';

describe('deepLinkService builders', () => {
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

  it('builds a village view link', () => {
    expect(getVillageViewLink('mun_abc')).toEqual({
      url: 'https://example.test.app/village/mun_abc',
      kind: 'content',
      resource: 'village',
      id: 'mun_abc',
    });
  });

  it('builds a village invite link with /join suffix', () => {
    expect(getVillageInviteLink('mun_abc')).toEqual({
      url: 'https://example.test.app/village/mun_abc/join',
      kind: 'invite',
      resource: 'village',
      id: 'mun_abc',
    });
  });

  it('builds an organization view link using /o/', () => {
    expect(getOrgViewLink('org_xyz')).toEqual({
      url: 'https://example.test.app/o/org_xyz',
      kind: 'content',
      resource: 'organization',
      id: 'org_xyz',
    });
  });

  it('builds an organization invite link with /join suffix', () => {
    expect(getOrgInviteLink('org_xyz')).toEqual({
      url: 'https://example.test.app/o/org_xyz/join',
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

  it('parses a village view URL', () => {
    expect(parseLink('https://example.test.app/village/mun_abc')).toEqual({
      kind: 'content',
      resource: 'village',
      id: 'mun_abc',
    });
  });

  it('parses a village invite URL', () => {
    expect(parseLink('https://example.test.app/village/mun_abc/join')).toEqual({
      kind: 'invite',
      resource: 'village',
      id: 'mun_abc',
    });
  });

  it('parses an org invite URL', () => {
    expect(parseLink('https://example.test.app/o/org_xyz/join')).toEqual({
      kind: 'invite',
      resource: 'organization',
      id: 'org_xyz',
    });
  });

  it('rejects /join suffix on resources that do not support invite', () => {
    expect(parseLink('https://example.test.app/event/evt_1/join')).toBeNull();
    expect(parseLink('https://example.test.app/news/n_1/join')).toBeNull();
  });

  it('rejects unknown path suffixes', () => {
    expect(parseLink('https://example.test.app/village/m_1/banana')).toBeNull();
  });

  it('parses a cultuvilla:// scheme URL', () => {
    expect(parseLink('cultuvilla://event/evt_123')).toEqual({
      kind: 'content',
      resource: 'event',
      id: 'evt_123',
    });
  });

  it('parses a cultuvilla:// invite URL', () => {
    expect(parseLink('cultuvilla://village/mun_1/join')).toEqual({
      kind: 'invite',
      resource: 'village',
      id: 'mun_1',
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

  it('round-trips a village view link', () => {
    const link = getVillageViewLink('mun_round');
    expect(parseLink(link.url)).toEqual({
      kind: 'content',
      resource: 'village',
      id: 'mun_round',
    });
  });

  it('round-trips a village invite link', () => {
    const link = getVillageInviteLink('mun_round');
    expect(parseLink(link.url)).toEqual({
      kind: 'invite',
      resource: 'village',
      id: 'mun_round',
    });
  });
});

describe('deepLinkService.buildShareMessage', () => {
  const t = (key: string, vars?: Record<string, string | number>): string => {
    const map: Record<string, string> = {
      'deeplink.share.event.view': 'Mira «{name}»: {url}',
      'deeplink.share.news.view': 'Mira «{name}»: {url}',
      'deeplink.share.village.view': 'Mira {name}: {url}',
      'deeplink.share.village.invite': 'Te invito a unirte a {name}: {url}',
      'deeplink.share.organization.view': 'Mira {name}: {url}',
      'deeplink.share.organization.invite': 'Te invito a unirte a {name}: {url}',
    };
    let out: string = map[key] ?? key;
    if (!vars) return out;
    for (const k of Object.keys(vars)) {
      out = out.split(`{${k}}`).join(String(vars[k]));
    }
    return out;
  };

  it('interpolates the event title into the view message', () => {
    const link = getEventLink('evt_1');
    expect(buildShareMessage(link, t, 'Fiesta de San Juan')).toBe(
      `Mira «Fiesta de San Juan»: ${link.url}`,
    );
  });

  it('interpolates the village name into the invite message', () => {
    const link = getVillageInviteLink('mun_1');
    expect(buildShareMessage(link, t, 'Matabuena')).toBe(
      `Te invito a unirte a Matabuena: ${link.url}`,
    );
  });

  it('interpolates the village name into the view message', () => {
    const link = getVillageViewLink('mun_1');
    expect(buildShareMessage(link, t, 'Matabuena')).toBe(`Mira Matabuena: ${link.url}`);
  });

  it('interpolates the org name into the invite message', () => {
    const link = getOrgInviteLink('org_1');
    expect(buildShareMessage(link, t, 'Peña El Roble')).toBe(
      `Te invito a unirte a Peña El Roble: ${link.url}`,
    );
  });
});
