---
Status: Draft
Date: 2026-05-24
---

# Admin surfaces on mobile

## Context

Cultuvilla has two distinct admin tiers but, today, only one of them has a UI:

- **App admin** — global, cross-village. Managed through `admins/{uid}` and checked via `isAppAdmin(uid)` in `packages/shared/src/services/adminService.ts`. The existing web `/admin/*` route tree covers this: activate-village, organizer-request review, occupation catalog + proposal review, raw municipality registry CRUD.
- **Village admin** — scoped to one municipality. Held by the user listed in `municipality.community.adminUserId`. The existing web `/village/[id]/admin` route tree covers organizations, invite tokens, censo schema, etc.

The repo is now app-first: `apps/mobile/` is the only UI, and the web build is RN-Web of the same code. Today, there is no admin UI in `apps/mobile/`. App admins and village admins have no way to do their work from the app.

This spec covers porting both admin tiers into `apps/mobile/`, with the tiers clearly separated by entry point and route tree.

## Goals

- App admins can do triage and global config from their phone: activate villages, review organizer requests, manage the occupation catalog.
- Village admins can run their village from the village screen: barrios, cementerios, organizations, invite tokens, censo schema, community settings.
- The two tiers do not bleed into each other in the UI. App admin = global concerns. Village admin = one-village concerns.
- Non-admins see no admin doors at all.

## Non-goals

- Editing the raw municipality registry (name, province, comunidad autónoma, INE code) is **out of scope** for the app. The registry is INE-seeded and edited via Node scripts. The app only reads the registry (e.g. activar-pueblo picker).
- No new business logic. All Firestore reads/writes go through existing `packages/shared/src/services/*`. Mobile screens are render + service-call only.
- No mobile-specific admin features that don't exist on the web today.

## Tier split

### App admin (global) — entry: Profile tab → "Administración" row

Visible only when `isAppAdmin(uid)` returns true. Opens a stacked `app/admin/` route tree.

Screens:

1. **Hub** (`app/admin/index.tsx`)
   - Card grid: "Activar pueblo", "Solicitudes de organizador", "Ocupaciones".
2. **Activar pueblo** (`app/admin/activate-village.tsx`)
   - Searchable picker over the existing municipality registry (read-only — the registry is not editable from the app).
   - Form for `VillageCommunity` fields: description, cover images, `adminUserId` (defaults to current user).
   - Calls existing `municipalityService.activateCommunity`.
3. **Solicitudes de organizador** (`app/admin/organizer-requests.tsx`)
   - List of pending `OrganizerRequestData` via `organizerRequestService.getPendingOrganizerRequests`.
   - Approve / reject via `respondToOrganizerRequest`.
4. **Ocupaciones** (`app/admin/occupations.tsx`)
   - Two sections: catalog CRUD (`createOccupation` / `updateOccupation` / `deleteOccupation`) and pending proposals (`getPendingProposals` / `reviewProposal`).

### Village admin (per-village) — entry: gear icon in the village screen header

Visible only when `villageMember.role === 'admin' || isAppAdmin(uid)` for that municipality. The gear icon sits in the village detail screen header (the screen reached by the middle tab when the user has an active village). On press, it opens `app/village/[villageId]/admin/`.

Screens:

1. **Hub** (`app/village/[villageId]/admin/index.tsx`)
   - Card grid linking to the six per-village admin areas.
2. **Barrios** (`barrios.tsx`) — CRUD via `municipalityService.createBarrio` / `updateBarrio` / `deleteBarrio`.
3. **Cementerios** (`cemeteries.tsx`) — CRUD via `createCemetery` / `updateCemetery` / `deleteCemetery`.
4. **Organizaciones** (`organizations.tsx`) — list + approve/reject via `organizationService`.
5. **Invitaciones** (`invite-tokens.tsx`) — list + create + delete via `inviteTokenService`. Copy-to-clipboard for the invite URL.
6. **Censo** (`censo.tsx`) — schema editor; same locked-field-detection logic as web (`collectUsedValues` from `membershipProfileService`). The existing `app/village/[villageId]/admin/requests.tsx` (join-request triage) is also reachable from this hub.
7. **Comunidad** (`community.tsx`) — edit description, cover images. Calls `municipalityService.updateCommunity`.

The existing `requests.tsx` screen (join-request triage) stays where it is and is linked from the hub.

## Routing layout (Expo Router)

```
apps/mobile/app/
  (tabs)/
    profile.tsx                          ← add "Administración" row (admin-only)
  admin/                                  ← NEW: app-admin tree
    _layout.tsx                           guard: redirect if !isAppAdmin
    index.tsx                             hub
    activate-village.tsx
    organizer-requests.tsx
    occupations.tsx
  village/[villageId]/
    index.tsx                             ← add gear icon in header (admin-only)
    admin/
      _layout.tsx                         guard: redirect if !canManage
      index.tsx                           hub (NEW)
      barrios.tsx                         NEW
      cemeteries.tsx                      NEW
      organizations.tsx                   NEW
      invite-tokens.tsx                   NEW
      censo.tsx                           NEW
      community.tsx                       NEW
      requests.tsx                        already exists
```

## Permission guards

Two layers, both required:

1. **Render-time gating** — the entry-point UI elements (Profile "Administración" row, village header gear icon) only render when the relevant predicate is true. Non-admins never see the doors.
2. **Route-layout guards** — `app/admin/_layout.tsx` and `app/village/[villageId]/admin/_layout.tsx` re-check the predicate on mount. If it fails, they `router.replace('/')` or `router.replace('/village/[villageId]')` respectively. Defense in depth against deep-linking.

`isAppAdmin(uid)` is async — both guards show a brief loading state while the check is in flight, then either render children or redirect. A reusable hook `useIsAppAdmin()` should be lifted into `apps/mobile/lib/auth/` if not already present.

## Reused services

All logic stays in `packages/shared/src/services/*`:

- `adminService.isAppAdmin`
- `municipalityService` (registry read, `activateCommunity`, `updateCommunity`, barrios CRUD, cemeteries CRUD)
- `organizerRequestService`
- `occupationService`
- `inviteTokenService`
- `censoService`, `membershipProfileService`
- `organizationService`
- `villageMemberService` (role check for the village-admin guard)

Mobile screens import and call these directly. No new shared logic.

## i18n

All new strings go through the i18n package (per `i18n-add-string` skill). Namespace: `admin.*` for the app-admin tree, `village.admin.*` for the village-admin tree. The hub labels ("Administración", "Activar pueblo", etc.) are catalog entries, not hardcoded.

## Visual conventions

- App-admin hub: card grid matching the existing web `/admin` hub layout, ported to React Native components used elsewhere in the app.
- Village-admin gear icon: header right slot on the village detail screen, using the same Ionicons set already used by the tab bar (`settings-outline` or `cog-outline`).
- Form patterns reuse existing primitives in `apps/mobile/components/` (e.g. the same forms used in onboarding for text input, image upload).

## Testing

- **Unit tests** (vitest in `packages/shared`) — none new; all service functions already covered.
- **Component tests** (where they exist for similar mobile screens) — guard behavior: predicate-false redirects, predicate-true renders.
- **Manual verification** — log in as a non-admin (Profile row hidden, gear icon hidden, deep-links redirect), as a village admin only (gear icon shown on own village, hidden on others, no Profile row), as an app admin (Profile row shown, gear icon shown on every village).

## Open questions

None at design time. All scope questions resolved during brainstorming.

## Out of scope / future

- Audit log of admin actions.
- In-app notifications for admins when a new organizer request or occupation proposal arrives. The existing notifications system can be wired up later.
- App admins editing the raw municipality registry from the app — stays as scripts.
