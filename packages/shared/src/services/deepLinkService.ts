import Constants from 'expo-constants';

export type LinkKind = 'content' | 'invite';
export type DeepLinkResource =
  | 'event'
  | 'news'
  | 'village'
  | 'organization'
  | 'place'
  | 'barrio'
  | 'person';

export interface DeepLink {
  url: string;
  kind: LinkKind;
  resource: DeepLinkResource;
  id: string;
  /** Parent id for resources nested under a village (place, barrio). */
  parentId?: string;
}

const RESOURCE_TO_PATH: Record<DeepLinkResource, string> = {
  event: 'event',
  news: 'news',
  village: 'village',
  organization: 'o',
  // Nested resources live under /village/<villageId>/...; see buildNestedLink.
  place: 'village',
  barrio: 'village',
  person: 'person',
};

const SUPPORTS_INVITE: Record<DeepLinkResource, boolean> = {
  event: false,
  news: false,
  village: false,
  organization: true,
  place: false,
  barrio: false,
  person: false,
};

/**
 * Resources nested under a village. The URL is
 * /village/<villageId>/<childPath>/<id> and the parsed link carries the village
 * id in `parentId`.
 */
const NESTED_CHILD_PATH = {
  place: 'place',
  barrio: 'barrio',
} as const;

type NestedResource = keyof typeof NESTED_CHILD_PATH;
const NESTED_PARENT_PATH = 'village';

const INVITE_SUFFIX = 'join';

export function getDeepLinkHost(): string {
  const extra = Constants.expoConfig?.extra ?? {};
  const host: unknown = (extra as Record<string, unknown>)['deepLinkHost'];
  if (typeof host !== 'string' || host.length === 0) {
    throw new Error(
      'deepLinkService: extra.deepLinkHost is not configured. Set DEEP_LINK_HOST_<ENV> env vars or app.config.ts extra.deepLinkHost.',
    );
  }
  return host;
}

function buildLink(resource: DeepLinkResource, id: string, kind: LinkKind): DeepLink {
  if (!id) throw new Error(`deepLinkService: id is required for ${resource}`);
  if (kind === 'invite' && !SUPPORTS_INVITE[resource]) {
    throw new Error(`deepLinkService: ${resource} does not have an invite link`);
  }
  const host = getDeepLinkHost();
  const path = RESOURCE_TO_PATH[resource];
  const suffix = kind === 'invite' ? `/${INVITE_SUFFIX}` : '';
  return {
    url: `https://${host}/${path}/${id}${suffix}`,
    kind,
    resource,
    id,
  };
}

export const getEventLink = (eventId: string): DeepLink => buildLink('event', eventId, 'content');
export const getNewsLink = (newsId: string): DeepLink => buildLink('news', newsId, 'content');

export const getVillageViewLink = (villageId: string): DeepLink =>
  buildLink('village', villageId, 'content');

export const getPersonViewLink = (personId: string): DeepLink =>
  buildLink('person', personId, 'content');

export const getOrgViewLink = (orgId: string): DeepLink =>
  buildLink('organization', orgId, 'content');
export const getOrgInviteLink = (orgId: string): DeepLink =>
  buildLink('organization', orgId, 'invite');

function buildNestedLink(resource: NestedResource, villageId: string, id: string): DeepLink {
  if (!villageId) throw new Error(`deepLinkService: villageId is required for ${resource}`);
  if (!id) throw new Error(`deepLinkService: id is required for ${resource}`);
  const host = getDeepLinkHost();
  const childPath = NESTED_CHILD_PATH[resource];
  return {
    url: `https://${host}/${NESTED_PARENT_PATH}/${villageId}/${childPath}/${id}`,
    kind: 'content',
    resource,
    id,
    parentId: villageId,
  };
}

export const getPlaceViewLink = (villageId: string, placeId: string): DeepLink =>
  buildNestedLink('place', villageId, placeId);
export const getBarrioViewLink = (villageId: string, barrioId: string): DeepLink =>
  buildNestedLink('barrio', villageId, barrioId);

export interface ParsedDeepLink {
  kind: LinkKind;
  resource: DeepLinkResource;
  id: string;
  /** Parent id for resources nested under a village (place, barrio). */
  parentId?: string;
}

const CHILD_PATH_TO_RESOURCE: { readonly [path: string]: NestedResource | undefined } = {
  place: 'place',
  barrio: 'barrio',
};

const PATH_TO_RESOURCE: { readonly [path: string]: DeepLinkResource | undefined } = {
  event: 'event',
  news: 'news',
  village: 'village',
  o: 'organization',
  person: 'person',
};

const SCHEME = 'cultuvilla';

function interpret(segments: string[]): ParsedDeepLink | null {
  if (segments.length === 2) {
    const [pathSegment, id] = segments as [string, string];
    const resource = PATH_TO_RESOURCE[pathSegment];
    if (!resource) return null;
    return { kind: 'content', resource, id };
  }
  if (segments.length === 3) {
    const [pathSegment, id, suffix] = segments as [string, string, string];
    if (suffix !== INVITE_SUFFIX) return null;
    const resource = PATH_TO_RESOURCE[pathSegment];
    if (!resource || !SUPPORTS_INVITE[resource]) return null;
    return { kind: 'invite', resource, id };
  }
  if (segments.length === 4) {
    const [parentSegment, parentId, childSegment, id] = segments as [
      string,
      string,
      string,
      string,
    ];
    if (parentSegment !== NESTED_PARENT_PATH) return null;
    const resource = CHILD_PATH_TO_RESOURCE[childSegment];
    if (!resource) return null;
    return { kind: 'content', resource, id, parentId };
  }
  return null;
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

export type DeepLinkTranslate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

export function buildShareMessage(
  link: DeepLink,
  t: DeepLinkTranslate,
  name: string,
): string {
  const kindKey = link.kind === 'invite' ? 'invite' : 'view';
  return t(`deeplink.share.${link.resource}.${kindKey}`, {
    url: link.url,
    name,
  });
}
