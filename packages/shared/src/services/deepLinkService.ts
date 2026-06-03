import Constants from 'expo-constants';

export type LinkKind = 'content' | 'invite';
export type DeepLinkResource = 'event' | 'news' | 'village' | 'organization';

export interface DeepLink {
  url: string;
  kind: LinkKind;
  resource: DeepLinkResource;
  id: string;
}

const RESOURCE_TO_PATH: Record<DeepLinkResource, string> = {
  event: 'event',
  news: 'news',
  village: 'village',
  organization: 'o',
};

const RESOURCE_TO_KIND: Record<DeepLinkResource, LinkKind> = {
  event: 'content',
  news: 'content',
  village: 'invite',
  organization: 'invite',
};

export function getDeepLinkHost(): string {
  const host = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[
    'deepLinkHost'
  ];
  if (typeof host !== 'string' || host.length === 0) {
    throw new Error(
      'deepLinkService: extra.deepLinkHost is not configured. Set DEEP_LINK_HOST_<ENV> env vars or app.config.ts extra.deepLinkHost.',
    );
  }
  return host;
}

function buildLink(resource: DeepLinkResource, id: string): DeepLink {
  if (!id) throw new Error(`deepLinkService: id is required for ${resource}`);
  const host = getDeepLinkHost();
  const path = RESOURCE_TO_PATH[resource];
  return {
    url: `https://${host}/${path}/${id}`,
    kind: RESOURCE_TO_KIND[resource],
    resource,
    id,
  };
}

export const getEventLink = (eventId: string): DeepLink => buildLink('event', eventId);
export const getNewsLink = (newsId: string): DeepLink => buildLink('news', newsId);
export const getVillageInviteLink = (villageId: string): DeepLink =>
  buildLink('village', villageId);
export const getOrgInviteLink = (orgId: string): DeepLink => buildLink('organization', orgId);

export interface ParsedDeepLink {
  kind: LinkKind;
  resource: DeepLinkResource;
  id: string;
}

const PATH_TO_RESOURCE: Record<string, DeepLinkResource> = {
  event: 'event',
  news: 'news',
  village: 'village',
  o: 'organization',
};

const SCHEME = 'cultuvilla';

function interpret(segments: string[]): ParsedDeepLink | null {
  if (segments.length !== 2) return null;
  const [pathSegment, id] = segments;
  const resource = PATH_TO_RESOURCE[pathSegment];
  if (!resource || !id) return null;
  return { kind: RESOURCE_TO_KIND[resource], resource, id };
}

export function parseLink(input: string): ParsedDeepLink | null {
  if (input.startsWith(`${SCHEME}://`)) {
    const rest = input.slice(`${SCHEME}://`.length);
    return interpret(rest.split('/').filter(Boolean));
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.hostname !== getDeepLinkHost()) return null;
  return interpret(url.pathname.split('/').filter(Boolean));
}
