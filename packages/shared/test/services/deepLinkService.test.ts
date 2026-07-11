import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { deepLinkHost: 'example.test.app' } } },
}));

import {
  getEventLink,
  getNewsLink,
  getVillageViewLink,
  getOrgViewLink,
  getOrgInviteLink,
  getUserViewLink,
  getPlaceViewLink,
  getBarrioViewLink,
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

  it('builds a place view link nested under its village', () => {
    expect(getPlaceViewLink('mun_abc', 'place_1')).toEqual({
      url: 'https://example.test.app/village/mun_abc/place/place_1',
      kind: 'content',
      resource: 'place',
      id: 'place_1',
      parentId: 'mun_abc',
    });
  });

  it('builds a barrio view link nested under its village', () => {
    expect(getBarrioViewLink('mun_abc', 'barrio_1')).toEqual({
      url: 'https://example.test.app/village/mun_abc/barrio/barrio_1',
      kind: 'content',
      resource: 'barrio',
      id: 'barrio_1',
      parentId: 'mun_abc',
    });
  });

  it('builds a user profile view link using /user/', () => {
    expect(getUserViewLink('uid_1')).toEqual({
      url: 'https://example.test.app/user/uid_1',
      kind: 'content',
      resource: 'user',
      id: 'uid_1',
    });
  });

  it('throws on empty id', () => {
    expect(() => getEventLink('')).toThrow(/id/i);
  });

  it('throws when a nested link is missing its village id', () => {
    expect(() => getPlaceViewLink('', 'place_1')).toThrow(/village/i);
    expect(() => getBarrioViewLink('', 'barrio_1')).toThrow(/village/i);
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
    expect(parseLink('https://example.test.app/village/mun_abc/join')).toBeNull();
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
    expect(parseLink('cultuvilla://o/org_1/join')).toEqual({
      kind: 'invite',
      resource: 'organization',
      id: 'org_1',
    });
  });

  it('returns null for a host mismatch', () => {
    expect(parseLink('https://other.host/event/evt_123')).toBeNull();
  });

  it('parses a user profile view URL', () => {
    expect(parseLink('https://example.test.app/user/uid_1')).toEqual({
      kind: 'content',
      resource: 'user',
      id: 'uid_1',
    });
  });

  it('round-trips a user profile view link', () => {
    const link = getUserViewLink('uid_round');
    expect(parseLink(link.url)).toEqual({
      kind: 'content',
      resource: 'user',
      id: 'uid_round',
    });
  });

  it('returns null for an unknown resource segment', () => {
    expect(parseLink('https://example.test.app/profile/user_1')).toBeNull();
  });

  it('no longer parses a /person/ URL (person is the editor, not a shareable view)', () => {
    expect(parseLink('https://example.test.app/person/person_1')).toBeNull();
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

  it('parses a nested place URL', () => {
    expect(parseLink('https://example.test.app/village/mun_abc/place/place_1')).toEqual({
      kind: 'content',
      resource: 'place',
      id: 'place_1',
      parentId: 'mun_abc',
    });
  });

  it('parses a nested barrio URL', () => {
    expect(parseLink('https://example.test.app/village/mun_abc/barrio/barrio_1')).toEqual({
      kind: 'content',
      resource: 'barrio',
      id: 'barrio_1',
      parentId: 'mun_abc',
    });
  });

  it('parses a nested place cultuvilla:// URL', () => {
    expect(parseLink('cultuvilla://village/mun_abc/place/place_1')).toEqual({
      kind: 'content',
      resource: 'place',
      id: 'place_1',
      parentId: 'mun_abc',
    });
  });

  it('rejects an unknown nested child segment', () => {
    expect(parseLink('https://example.test.app/village/mun_abc/banana/x')).toBeNull();
  });

  it('rejects a nested path whose parent is not a village', () => {
    expect(parseLink('https://example.test.app/o/org_1/place/place_1')).toBeNull();
  });

  it('round-trips a place view link', () => {
    const link = getPlaceViewLink('mun_round', 'place_round');
    expect(parseLink(link.url)).toEqual({
      kind: 'content',
      resource: 'place',
      id: 'place_round',
      parentId: 'mun_round',
    });
  });

  it('round-trips a barrio view link', () => {
    const link = getBarrioViewLink('mun_round', 'barrio_round');
    expect(parseLink(link.url)).toEqual({
      kind: 'content',
      resource: 'barrio',
      id: 'barrio_round',
      parentId: 'mun_round',
    });
  });
});

describe('deepLinkService.buildShareMessage', () => {
  const t = (key: string, vars?: Record<string, string | number>): string => {
    const map: Record<string, string> = {
      'deeplink.share.event.view': 'Mira «{name}»: {url}',
      'deeplink.share.news.view': 'Mira «{name}»: {url}',
      'deeplink.share.village.view': 'Mira {name}: {url}',
      'deeplink.share.organization.view': 'Mira {name}: {url}',
      'deeplink.share.organization.invite': 'Te invito a unirte a {name}: {url}',
      'deeplink.share.place.view': 'Mira «{name}»: {url}',
      'deeplink.share.barrio.view': 'Mira {name}: {url}',
      'deeplink.share.user.view': 'Mira el perfil de {name}: {url}',
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

  it('interpolates the place name into the view message', () => {
    const link = getPlaceViewLink('mun_1', 'place_1');
    expect(buildShareMessage(link, t, 'Ermita de San Roque')).toBe(
      `Mira «Ermita de San Roque»: ${link.url}`,
    );
  });

  it('interpolates the barrio name into the view message', () => {
    const link = getBarrioViewLink('mun_1', 'barrio_1');
    expect(buildShareMessage(link, t, 'El Arrabal')).toBe(`Mira El Arrabal: ${link.url}`);
  });

  it('interpolates the user name into the profile view message', () => {
    const link = getUserViewLink('uid_1');
    expect(buildShareMessage(link, t, 'María García')).toBe(
      `Mira el perfil de María García: ${link.url}`,
    );
  });
});
