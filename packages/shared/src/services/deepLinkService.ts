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
