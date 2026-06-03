# Deep link service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared URL-building service, mobile routing glue, native Universal Link / App Link configuration, hosting AASA/assetlinks delivery, and the prerequisite news/org stub routes so that an `https://<host>/event|news|village|o/<id>` link opens the app on a phone with cultuvilla installed and renders the web export otherwise.

**Architecture:** Three layers — pure shared URL builder (`packages/shared`), mobile glue (`apps/mobile/lib/deeplink`), and web rendering (already provided by the Expo web export). Native config (`associatedDomains` / `intentFilters`) reads the host from `app.config.ts` `extra.deepLinkHost`, which is sourced from per-env env vars with safe Firebase Hosting defaults.

**Tech Stack:** TypeScript, Expo SDK 54, `expo-linking` v8, `expo-router`, Firebase Hosting, vitest (`packages/shared`), Jest + RN Testing Library (`apps/mobile`).

**Spec:** [docs/superpowers/specs/2026-06-03-deeplink-service-design.md](../specs/2026-06-03-deeplink-service-design.md)

---

## Task 1: Shared URL builders (`getEventLink`, `getNewsLink`, `getVillageInviteLink`, `getOrgInviteLink`)

**Files:**
- Create: `packages/shared/src/services/deepLinkService.ts`
- Create: `packages/shared/test/services/deepLinkService.test.ts`
- Modify: `packages/shared/src/services/index.ts` — append re-export.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/test/services/deepLinkService.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```
pnpm --filter @cultuvilla/shared test deepLinkService
```
Expected: FAIL with "Cannot find module '../../src/services/deepLinkService'".

- [ ] **Step 3: Write the implementation**

```ts
// packages/shared/src/services/deepLinkService.ts
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
```

- [ ] **Step 4: Re-export from the services index**

```ts
// packages/shared/src/services/index.ts (append after existing exports, before listenerManager line)
export * from './deepLinkService'
```

- [ ] **Step 5: Run tests to verify they pass**

```
pnpm --filter @cultuvilla/shared test deepLinkService
```
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/deepLinkService.ts \
        packages/shared/src/services/index.ts \
        packages/shared/test/services/deepLinkService.test.ts
git commit -m "feat(shared): add deepLinkService URL builders for events, news, villages, orgs"
```

---

## Task 2: Shared `parseLink`

**Files:**
- Modify: `packages/shared/src/services/deepLinkService.ts` — add `parseLink` + `ParsedDeepLink`.
- Modify: `packages/shared/test/services/deepLinkService.test.ts` — add parser tests.

- [ ] **Step 1: Append failing tests**

```ts
// add to packages/shared/test/services/deepLinkService.test.ts
import { parseLink } from '../../src/services/deepLinkService';

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
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm --filter @cultuvilla/shared test deepLinkService
```
Expected: FAIL on the 9 new tests with "parseLink is not a function".

- [ ] **Step 3: Implement `parseLink`**

The custom-scheme branch does NOT rely on `new URL(…)` because WHATWG URL parsing leaves `hostname` empty for non-special schemes like `cultuvilla:`. We split the path manually instead.

```ts
// add to packages/shared/src/services/deepLinkService.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```
pnpm --filter @cultuvilla/shared test deepLinkService
```
Expected: PASS (14 tests total).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/services/deepLinkService.ts \
        packages/shared/test/services/deepLinkService.test.ts
git commit -m "feat(shared): add parseLink for https + cultuvilla scheme URLs"
```

---

## Task 3: Shared `buildShareMessage` + i18n keys

**Files:**
- Modify: `packages/shared/src/services/deepLinkService.ts` — add `buildShareMessage`.
- Modify: `packages/shared/test/services/deepLinkService.test.ts` — add tests.
- Modify: `packages/i18n/messages/es.json` — add `deeplink.share.*` keys.

- [ ] **Step 1: Add i18n keys**

```jsonc
// packages/i18n/messages/es.json — add a top-level "deeplink" namespace
"deeplink": {
  "share": {
    "event":        "Te invito a este evento en Cultuvilla: {url}",
    "news":         "Mira esta noticia en Cultuvilla: {url}",
    "village":      "Te invito a este pueblo en Cultuvilla: {url}",
    "organization": "Te invito a esta organización en Cultuvilla: {url}"
  }
}
```

- [ ] **Step 2: Append failing test**

```ts
// add to packages/shared/test/services/deepLinkService.test.ts
import { buildShareMessage } from '../../src/services/deepLinkService';

describe('deepLinkService.buildShareMessage', () => {
  const t = (key: string, vars?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      'deeplink.share.event':        'Te invito a este evento: {url}',
      'deeplink.share.news':         'Mira esta noticia: {url}',
      'deeplink.share.village':      'Te invito a este pueblo: {url}',
      'deeplink.share.organization': 'Te invito a esta organización: {url}',
    };
    let out = map[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };

  it('produces an event share message', () => {
    const link = getEventLink('evt_1');
    expect(buildShareMessage(link, t)).toBe(
      `Te invito a este evento: ${link.url}`,
    );
  });

  it('produces a village share message', () => {
    const link = getVillageInviteLink('mun_1');
    expect(buildShareMessage(link, t)).toBe(
      `Te invito a este pueblo: ${link.url}`,
    );
  });

  it('produces an organization share message', () => {
    const link = getOrgInviteLink('org_1');
    expect(buildShareMessage(link, t)).toBe(
      `Te invito a esta organización: ${link.url}`,
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```
pnpm --filter @cultuvilla/shared test deepLinkService
```
Expected: FAIL with "buildShareMessage is not a function".

- [ ] **Step 4: Implement `buildShareMessage`**

```ts
// add to packages/shared/src/services/deepLinkService.ts
export type DeepLinkTranslate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

export function buildShareMessage(link: DeepLink, t: DeepLinkTranslate): string {
  return t(`deeplink.share.${link.resource}`, { url: link.url });
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
pnpm --filter @cultuvilla/shared test deepLinkService
```
Expected: PASS (17 tests total).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/services/deepLinkService.ts \
        packages/shared/test/services/deepLinkService.test.ts \
        packages/i18n/messages/es.json
git commit -m "feat(shared): add buildShareMessage + Spanish share copy"
```

---

## Task 4: Wire `deepLinkHost` into `app.config.ts` extra

**Files:**
- Modify: `apps/mobile/app.config.ts:11-25` — add `deepLinkHostPerEnv`.
- Modify: `apps/mobile/app.config.ts:121-128` — extend `extra`.

This makes the host available to `Constants.expoConfig.extra.deepLinkHost` so the shared service can read it.

- [ ] **Step 1: Add the per-env table near other per-env tables**

Insert after the `bundleIdPerEnv` block (around line 24):

```ts
const deepLinkHostPerEnv: Record<Env, string> = {
  dev: process.env['DEEP_LINK_HOST_DEV'] ?? 'villa-events-dev.web.app',
  beta: process.env['DEEP_LINK_HOST_BETA'] ?? 'villa-events-beta.web.app',
  prod: process.env['DEEP_LINK_HOST_PROD'] ?? 'villa-events.web.app',
};
```

- [ ] **Step 2: Add `deepLinkHost` to `extra`**

In the `extra: { … }` block, append:

```ts
extra: {
  APP_ENV: env,
  firebaseConfig: firebaseConfigPerEnv[env],
  googleSignIn: googleSignInPerEnv[env],
  deepLinkHost: deepLinkHostPerEnv[env],
  eas: {
    projectId: process.env['EAS_PROJECT_ID'] ?? '',
  },
},
```

- [ ] **Step 3: Verify the typecheck still passes**

```
pnpm --filter cultuvilla-mobile typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app.config.ts
git commit -m "feat(mobile): expose deepLinkHost per env in app.config.ts extra"
```

---

## Task 5: Mobile `useDeepLinkRouter` hook + tests

**Files:**
- Create: `apps/mobile/lib/deeplink/useDeepLinkRouter.ts`
- Create: `apps/mobile/lib/deeplink/__tests__/useDeepLinkRouter.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/mobile/lib/deeplink/__tests__/useDeepLinkRouter.test.tsx
import { render, waitFor } from '@testing-library/react-native';
import { vi } from 'vitest';

const getInitialURL = vi.fn();
const addEventListener = vi.fn();
const remove = vi.fn();
const replace = vi.fn();

vi.mock('expo-linking', () => ({
  getInitialURL: () => getInitialURL(),
  addEventListener: (event: string, handler: (e: { url: string }) => void) => {
    addEventListener(event, handler);
    return { remove };
  },
}));

vi.mock('expo-router', () => ({
  router: { replace: (path: string) => replace(path) },
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { extra: { deepLinkHost: 'example.test.app' } } },
}));

import { useDeepLinkRouter } from '../useDeepLinkRouter';

function Probe() {
  useDeepLinkRouter();
  return null;
}

describe('useDeepLinkRouter', () => {
  beforeEach(() => {
    getInitialURL.mockReset();
    addEventListener.mockReset();
    remove.mockReset();
    replace.mockReset();
  });

  it('routes the initial URL when present (event)', async () => {
    getInitialURL.mockResolvedValueOnce('https://example.test.app/event/evt_1');
    render(<Probe />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/event/evt_1'));
  });

  it('maps organization to /o/', async () => {
    getInitialURL.mockResolvedValueOnce('https://example.test.app/o/org_1');
    render(<Probe />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/o/org_1'));
  });

  it('routes a runtime URL event', async () => {
    getInitialURL.mockResolvedValueOnce(null);
    render(<Probe />);
    await waitFor(() => expect(addEventListener).toHaveBeenCalled());
    const handler = addEventListener.mock.calls[0][1] as (e: { url: string }) => void;
    handler({ url: 'https://example.test.app/village/mun_9' });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/village/mun_9'));
  });

  it('ignores unknown URLs', async () => {
    getInitialURL.mockResolvedValueOnce('https://example.test.app/unknown/x');
    render(<Probe />);
    await waitFor(() => expect(addEventListener).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', async () => {
    getInitialURL.mockResolvedValueOnce(null);
    const { unmount } = render(<Probe />);
    await waitFor(() => expect(addEventListener).toHaveBeenCalled());
    unmount();
    expect(remove).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
pnpm --filter cultuvilla-mobile test useDeepLinkRouter
```
Expected: FAIL with "Cannot find module '../useDeepLinkRouter'".

- [ ] **Step 3: Implement the hook**

```ts
// apps/mobile/lib/deeplink/useDeepLinkRouter.ts
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import {
  parseLink,
  type DeepLinkResource,
} from '@cultuvilla/shared/services/deepLinkService';

const RESOURCE_TO_ROUTE: Record<DeepLinkResource, string> = {
  event: 'event',
  news: 'news',
  village: 'village',
  organization: 'o',
};

function route(url: string): void {
  const parsed = parseLink(url);
  if (!parsed) return;
  const segment = RESOURCE_TO_ROUTE[parsed.resource];
  router.replace(`/${segment}/${parsed.id}` as never);
}

export function useDeepLinkRouter(): void {
  useEffect(() => {
    let cancelled = false;
    void Linking.getInitialURL().then((url) => {
      if (!cancelled && url) route(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => route(url));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
pnpm --filter cultuvilla-mobile test useDeepLinkRouter
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/deeplink/useDeepLinkRouter.ts \
        apps/mobile/lib/deeplink/__tests__/useDeepLinkRouter.test.tsx
git commit -m "feat(mobile): add useDeepLinkRouter hook"
```

---

## Task 6: Mount `useDeepLinkRouter` in the root layout

**Files:**
- Modify: `apps/mobile/app/_layout.tsx` — call `useDeepLinkRouter()` inside `AuthGate`.

The hook depends on `expo-router`'s `router` global. Mounting it inside `AuthGate` (which already runs under `AuthProvider` and `expo-router`'s `Stack`) ensures the router is initialized when the hook fires its `router.replace`.

- [ ] **Step 1: Add the import**

```ts
// apps/mobile/app/_layout.tsx — add to the existing import block
import { useDeepLinkRouter } from '../lib/deeplink/useDeepLinkRouter';
```

- [ ] **Step 2: Call the hook inside `AuthGate`**

In the `AuthGate` function body, right after the existing hook calls:

```ts
function AuthGate() {
  const { user, loading, profile, profileChecked } = useAuth();
  const segments = useSegments();
  useDeepLinkRouter();
  // …rest unchanged
}
```

- [ ] **Step 3: Typecheck**

```
pnpm --filter cultuvilla-mobile typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): mount useDeepLinkRouter in AuthGate"
```

---

## Task 7: News detail stub route

**Files:**
- Create: `apps/mobile/app/news/[newsId].tsx`

A stub that satisfies the deep-link contract — opening `https://<host>/news/<id>` lands here and renders. The full news-detail design (gallery, reactions, comments) is out of scope for this plan and will be implemented under the existing news-feed spec; this stub renders title + body if found, "not found" otherwise.

- [ ] **Step 1: Confirm the news service exposes a per-id getter**

```
grep -n "^export" packages/shared/src/services/newsService.ts | head -5
```
Expected to include something like `export async function getNewsPost(newsId: string)`. If only a different name exists, use that name in the stub below.

- [ ] **Step 2: Create the stub screen**

```tsx
// apps/mobile/app/news/[newsId].tsx
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { getNewsPost } from '@cultuvilla/shared/services/newsService';
import type { NewsPostData } from '@cultuvilla/shared/models/news/NewsPostDataModel';

type Post = NewsPostData & { id: string };

export default function NewsDetailStub() {
  const { newsId } = useLocalSearchParams<{ newsId: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!newsId) return;
    getNewsPost(newsId as string)
      .then((p) => setPost(p as Post | null))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [newsId]);

  return (
    <Screen>
      <AppHeader title={post?.title ?? 'Noticia'} />
      <VStack className="p-4 gap-3">
        {loading ? <ActivityIndicator /> : null}
        {error ? <Text className="text-error">{error}</Text> : null}
        {!loading && !post && !error ? <Text>No encontrada.</Text> : null}
        {post ? <Text>{post.body}</Text> : null}
      </VStack>
    </Screen>
  );
}
```

If `getNewsPost` does not exist under that name, replace with the function from `grep` output in Step 1; if `NewsPostDataModel` has different field names (`body` vs `content`), adjust to the actual field name.

- [ ] **Step 3: Typecheck**

```
pnpm --filter cultuvilla-mobile typecheck
```
Expected: PASS. If it fails on `getNewsPost` or `body`, fix per the error message and re-run.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/news/
git commit -m "feat(mobile): add news/[newsId] stub for deep-link landing"
```

---

## Task 8: Organization detail stub route with Join CTA

**Files:**
- Create: `apps/mobile/app/o/[orgId].tsx`

Stub: name, description, members count, Join CTA. Full org-detail UX is its own future spec.

V1 scope note: `addOrgMember` is a direct Firestore write. If org private/public differentiation lands later (the model has no `isPublic` flag today), the CTA needs to branch to a request-to-join flow — out of scope here.

- [ ] **Step 1: Confirm available services**

```
grep -nE "^export.*(getOrganization|getOrgMembers|isOrgMember|addOrgMember)" packages/shared/src/services/organizationService.ts packages/shared/src/services/orgMemberService.ts
```
Expected: `getOrganization`, `getOrgMembers`, `isOrgMember`, `addOrgMember` all present.

- [ ] **Step 2: Create the stub screen**

```tsx
// apps/mobile/app/o/[orgId].tsx
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/primitives/Screen';
import { Text } from '../../components/primitives/Text';
import { VStack } from '../../components/primitives/VStack';
import { useT } from '../../lib/i18n';
import { useAuth } from '../../lib/auth/useAuth';
import { getOrganization } from '@cultuvilla/shared/services/organizationService';
import {
  isOrgMember,
  addOrgMember,
  getOrgMembers,
} from '@cultuvilla/shared/services/orgMemberService';
import type { OrganizationData } from '@cultuvilla/shared/models/organization/OrganizationDataModel';

type Org = OrganizationData & { id: string };

export default function OrgDetailStub() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const { t } = useT();
  const { user } = useAuth();
  const [org, setOrg] = useState<Org | null>(null);
  const [membersCount, setMembersCount] = useState<number | null>(null);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    const o = await getOrganization(orgId as string);
    setOrg(o as Org | null);
    const members = await getOrgMembers(orgId as string);
    setMembersCount(members.length);
    if (user) setIsMember(await isOrgMember(orgId as string, user.uid));
    setLoading(false);
  }, [orgId, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onJoin = useCallback(async () => {
    if (!user || !orgId) {
      router.push('/(auth)/login' as never);
      return;
    }
    setJoining(true);
    try {
      await addOrgMember(orgId as string, user.uid);
      await refresh();
    } finally {
      setJoining(false);
    }
  }, [user, orgId, refresh]);

  return (
    <Screen>
      <AppHeader title={org?.name ?? t('organization.title')} />
      <VStack className="p-4 gap-3">
        {loading ? <ActivityIndicator /> : null}
        {!loading && !org ? <Text>{t('common.notFound')}</Text> : null}
        {org ? (
          <>
            <Text className="text-base">{org.description ?? ''}</Text>
            <Text className="text-sm text-muted">
              {t('organization.membersCount', { count: membersCount ?? 0 })}
            </Text>
            {!isMember ? (
              <Pressable
                onPress={onJoin}
                disabled={joining}
                className="bg-primary rounded-lg p-3 items-center"
                accessibilityLabel={t('organization.join')}
              >
                <Text className="text-on-primary">
                  {user ? t('organization.join') : t('organization.signInToJoin')}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </VStack>
    </Screen>
  );
}
```

- [ ] **Step 3: Add i18n keys**

```jsonc
// packages/i18n/messages/es.json — extend or add the "organization" namespace
"organization": {
  "title": "Organización",
  "membersCount": "{count} miembros",
  "join": "Unirme a esta organización",
  "signInToJoin": "Inicia sesión para unirte"
}
// also ensure "common.notFound" exists:
"common": {
  // …existing keys…
  "notFound": "No encontrado"
}
```

- [ ] **Step 4: Typecheck**

```
pnpm --filter cultuvilla-mobile typecheck
```
Expected: PASS. Fix any field-name mismatches (e.g. `description` vs `descripcion`) per the actual model.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/o/ packages/i18n/messages/es.json
git commit -m "feat(mobile): add o/[orgId] stub with Join CTA"
```

---

## Task 9: Village Join CTA for non-members

**Files:**
- Modify: `apps/mobile/app/village/[villageId]/index.tsx` — add `isVillageMember` check and a Join button.
- Modify: `packages/i18n/messages/es.json` — add `village.join` / `village.signInToJoin`.

The village screen already loads `villageAdmin` via `isVillageAdmin`. Mirror that pattern with `isVillageMember`, and surface a primary CTA when the viewer is not a member.

V1 scope note: V1 calls `addVillageMember` directly. If/when the village model adds an `isPublic` flag, this CTA should switch to `requestJoinVillage` for private villages — out of scope here.

- [ ] **Step 1: Extend the village screen state and effects**

Add to imports:
```ts
import { isVillageAdmin, isVillageMember, addVillageMember } from '@cultuvilla/shared/services/villageMemberService';
```
(`isVillageMember` and `addVillageMember` already exist per `villageMemberService.ts`.)

Add state and effect (next to `villageAdmin`):

```ts
const [isMember, setIsMember] = useState(false);
const [joining, setJoining] = useState(false);

useEffect(() => {
  if (!user || !villageId) return;
  isVillageMember(villageId as string, user.uid).then(setIsMember);
}, [user, villageId]);

const onJoin = async () => {
  if (!user || !villageId) {
    router.push('/(auth)/login' as never);
    return;
  }
  setJoining(true);
  try {
    await addVillageMember(villageId as string, user.uid);
    setIsMember(true);
  } finally {
    setJoining(false);
  }
};
```

- [ ] **Step 2: Render the CTA above the events list**

Insert in the JSX just below the `AppHeader`, before the events `FlatList`:

```tsx
{!isMember && village ? (
  <Pressable
    onPress={onJoin}
    disabled={joining}
    className="mx-4 my-2 bg-primary rounded-lg p-3 items-center"
    accessibilityLabel={t('village.join')}
  >
    <Text className="text-on-primary">
      {user ? t('village.join') : t('village.signInToJoin')}
    </Text>
  </Pressable>
) : null}
```

- [ ] **Step 3: Add i18n keys**

```jsonc
// packages/i18n/messages/es.json — extend or add the "village" namespace
"village": {
  // …existing keys…
  "join": "Unirme a este pueblo",
  "signInToJoin": "Inicia sesión para unirte"
}
```

- [ ] **Step 4: Typecheck + lint**

```
pnpm --filter cultuvilla-mobile typecheck && pnpm --filter cultuvilla-mobile lint
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/village/\[villageId\]/index.tsx \
        packages/i18n/messages/es.json
git commit -m "feat(mobile): surface Join CTA on village screen for non-members"
```

---

## Task 10: Native config — `associatedDomains` + `intentFilters`

**Files:**
- Modify: `apps/mobile/app.config.ts:105-115` — add `associatedDomains` to `ios` and `intentFilters` to `android`.

These declarations enable Universal Links (iOS) and App Links (Android) for the deep-link host.

- [ ] **Step 1: Update the `ios` block**

```ts
ios: {
  bundleIdentifier: bundleIdPerEnv[env],
  supportsTablet: true,
  associatedDomains: [`applinks:${deepLinkHostPerEnv[env]}`],
},
```

- [ ] **Step 2: Update the `android` block**

```ts
android: {
  package: bundleIdPerEnv[env],
  adaptiveIcon: {
    foregroundImage: './assets/adaptive-icon.png',
    backgroundColor: '#ffffff',
  },
  intentFilters: [
    {
      action: 'VIEW',
      autoVerify: true,
      data: [
        {
          scheme: 'https',
          host: deepLinkHostPerEnv[env],
          pathPrefix: '/event/',
        },
        {
          scheme: 'https',
          host: deepLinkHostPerEnv[env],
          pathPrefix: '/news/',
        },
        {
          scheme: 'https',
          host: deepLinkHostPerEnv[env],
          pathPrefix: '/village/',
        },
        {
          scheme: 'https',
          host: deepLinkHostPerEnv[env],
          pathPrefix: '/o/',
        },
      ],
      category: ['BROWSABLE', 'DEFAULT'],
    },
  ],
},
```

- [ ] **Step 3: Sanity-check `app.config.ts` renders**

```
pnpm --filter cultuvilla-mobile exec expo config --type public --json | jq '.ios.associatedDomains, .android.intentFilters'
```
Expected: prints the `applinks:` entry and the four intent-filter data entries.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app.config.ts
git commit -m "feat(mobile): declare associatedDomains and intentFilters for deep links"
```

---

## Task 11: AASA + assetlinks files and the per-env predeploy step

**Files:**
- Create: `apps/mobile/public/.well-known/dev/apple-app-site-association`
- Create: `apps/mobile/public/.well-known/dev/assetlinks.json`
- Create: `apps/mobile/public/.well-known/beta/apple-app-site-association`
- Create: `apps/mobile/public/.well-known/beta/assetlinks.json`
- Create: `apps/mobile/public/.well-known/prod/apple-app-site-association`
- Create: `apps/mobile/public/.well-known/prod/assetlinks.json`
- Create: `apps/mobile/scripts/copy-well-known.mjs`
- Modify: `apps/mobile/package.json` — add `prebuild:web:<env>` scripts.
- Modify: `package.json` — chain `predeploy:hosting:<env>` ahead of `deploy:hosting:<env>`.

The AASA file has no extension and serves JSON; assetlinks.json is JSON. They embed env-specific bundle IDs and signing-key SHA-256 fingerprints, so we keep three sets of source files and copy the active env into `apps/mobile/public/.well-known/` before `expo export -p web`.

Real Apple Team ID and Android signing-cert SHA-256 fingerprints are **not in this plan** — they come from EAS credentials and Apple Developer membership. The files below use placeholders that must be replaced before deploying.

- [ ] **Step 1: Create the dev AASA**

```json
// apps/mobile/public/.well-known/dev/apple-app-site-association (no extension)
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "REPLACE_TEAM_ID.com.cultuvilla.app.dev",
        "paths": ["/event/*", "/news/*", "/village/*", "/o/*"]
      }
    ]
  }
}
```

- [ ] **Step 2: Create the dev assetlinks.json**

```json
// apps/mobile/public/.well-known/dev/assetlinks.json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.cultuvilla.app.dev",
      "sha256_cert_fingerprints": ["REPLACE_SHA256_FINGERPRINT_DEV"]
    }
  }
]
```

- [ ] **Step 3: Repeat for beta and prod**

Same shape, substituting `com.cultuvilla.app.beta` / `com.cultuvilla.app` for the package name, the matching Apple App ID (`…app.beta` / `…app`), and the matching cert fingerprint per env. The Apple `paths` array is identical across envs.

- [ ] **Step 4: Add the copy script**

```js
// apps/mobile/scripts/copy-well-known.mjs
import { cpSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const env = process.argv[2];

if (!['dev', 'beta', 'prod'].includes(env ?? '')) {
  console.error(`copy-well-known: usage: copy-well-known.mjs <dev|beta|prod>`);
  process.exit(2);
}

const src = resolve(__dirname, `../public/.well-known/${env}`);
const dst = resolve(__dirname, `../public/.well-known`);
const target = (name) => resolve(dst, name);

if (!existsSync(src)) {
  console.error(`copy-well-known: missing source ${src}`);
  process.exit(1);
}

for (const name of ['apple-app-site-association', 'assetlinks.json']) {
  if (existsSync(target(name))) rmSync(target(name));
}

mkdirSync(dst, { recursive: true });
cpSync(resolve(src, 'apple-app-site-association'), target('apple-app-site-association'));
cpSync(resolve(src, 'assetlinks.json'), target('assetlinks.json'));
console.log(`copy-well-known: copied ${env} files into public/.well-known/`);
```

- [ ] **Step 5: Add a top-level `.gitignore` rule**

The active-env copies should not be committed (they are env-specific and overwritten on each deploy). Append to the root `.gitignore`:

```
# Active deep-link well-known files are copied at deploy time
apps/mobile/public/.well-known/apple-app-site-association
apps/mobile/public/.well-known/assetlinks.json
```

- [ ] **Step 6: Add `predeploy:hosting:<env>` scripts to the root `package.json`**

```jsonc
// package.json — replace existing deploy:hosting:* scripts
"predeploy:hosting:dev":  "node apps/mobile/scripts/copy-well-known.mjs dev",
"predeploy:hosting:beta": "node apps/mobile/scripts/copy-well-known.mjs beta",
"predeploy:hosting:prod": "node apps/mobile/scripts/copy-well-known.mjs prod",
"deploy:hosting:dev":  "pnpm predeploy:hosting:dev  && pnpm app:web:build && bash scripts/firebase.sh deploy --only hosting --project dev",
"deploy:hosting:beta": "pnpm predeploy:hosting:beta && pnpm app:web:build && bash scripts/firebase.sh deploy --only hosting --project beta",
"deploy:hosting:prod": "pnpm predeploy:hosting:prod && pnpm app:web:build && bash scripts/firebase.sh deploy --only hosting --project prod"
```

- [ ] **Step 7: Smoke-test the copy script**

```
node apps/mobile/scripts/copy-well-known.mjs dev
ls apps/mobile/public/.well-known/
```
Expected: `apple-app-site-association` and `assetlinks.json` exist alongside the `dev/ beta/ prod/` source dirs.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/public/.well-known/ \
        apps/mobile/scripts/copy-well-known.mjs \
        package.json .gitignore
git commit -m "feat(hosting): serve per-env AASA + assetlinks via predeploy copy"
```

---

## Task 12: Firebase Hosting `Content-Type` header for AASA

**Files:**
- Modify: `firebase.json` — add a header rule.

Firebase Hosting serves static files before applying rewrites, so the existing `**` → `/index.html` rewrite does not intercept `/.well-known/*`. The only missing piece is the `Content-Type: application/json` header on the extension-less AASA file.

- [ ] **Step 1: Edit `firebase.json` hosting headers**

Insert into the `headers` array of the `hosting` block (alongside the existing entries):

```jsonc
{
  "source": "/.well-known/apple-app-site-association",
  "headers": [
    { "key": "Content-Type", "value": "application/json" }
  ]
}
```

- [ ] **Step 2: Validate JSON**

```
jq . firebase.json > /dev/null && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add firebase.json
git commit -m "feat(hosting): set Content-Type application/json for AASA"
```

---

## Task 13: Final check — run the full project gate

- [ ] **Step 1: Run the full check pipeline**

```
pnpm check
```
Expected: PASS (no-raw-firestore-refs + typecheck + lint + test + build, all green).

- [ ] **Step 2: Manual end-to-end smoke checklist** (no automation — record outcomes in the commit body if anything fails):

1. `pnpm deploy:hosting:dev` — confirm the deploy completes and `apple-app-site-association` / `assetlinks.json` are reachable at the dev host with `Content-Type: application/json`:
   ```
   curl -sI https://villa-events-dev.web.app/.well-known/apple-app-site-association | grep -i content-type
   curl -s  https://villa-events-dev.web.app/.well-known/assetlinks.json | jq .
   ```
2. On a dev-client Android build, open `https://villa-events-dev.web.app/event/<known-id>` from a non-cultuvilla app (e.g. a note) and confirm the app opens directly at the event screen.
3. On a dev-client Android build (or web), open `https://villa-events-dev.web.app/o/<known-orgId>` and confirm the Join CTA appears for a non-member account.
4. On web, open the same URL; confirm the route renders with the Join CTA (or sign-in CTA when signed out).

- [ ] **Step 3: Commit** (if any docs were updated during smoke-testing)

```bash
git add -p
git commit -m "docs(plan): record deep-link deploy smoke-test outcomes"
```

---

## Out of scope (reaffirmed)

- Full news detail UX (gallery, reactions, comments) — owned by the news-feed spec; the stub here only satisfies the deep-link landing contract.
- Full organization detail UX — same, owned by a future org-detail spec.
- Token-based invites, social previews, click analytics, custom-domain migration tooling — see the spec's "Non-goals" section.
