# Edit affordance for organizations, places, and barrios

## Problem

There is currently no way to edit an organization (peña/asociación/ayuntamiento),
a place, or a barrio after it has been created. The three detail screens are
read-only hero screens with only floating back/share buttons. A user who created
a group — or a village admin — has no path to fix a name, description, type, or
image without going through the moderation lists buried in the community editor
(and even those don't support image editing).

## Goal

Add an **edit button in the top-right** of each of the three detail screens,
visible only to users with permission, that opens the entity in an edit form
reusing the existing creation form.

## Scope

In scope: org / place / barrio detail screens, a permission gate per entity, and
three edit routes reusing `ProposableForm`.

Out of scope: editing other entities (events, news, persons already have their own
flows), deleting from the detail screen, moderation/approval changes.

## Permission model (role-based)

Authority is always the role flag (per AGENTS.md), never a founder pointer.

- **Places & barrios** — reuse `useEntityCapabilities(municipalityId).canManage`
  (village admin OR app admin). Already exists at
  `apps/mobile/lib/auth/useEntityCapabilities.ts`.
- **Organizations** — no capabilities hook exists yet. Add:
  - `isOrgAdmin(orgId, uid)` in
    `packages/shared/src/services/orgMemberService.ts` (checks the caller's
    membership doc `role === 'admin'`; the founder is seeded as admin on approval,
    so "a group I created" is covered).
  - `useOrgCapabilities(orgId)` hook in `apps/mobile/lib/auth/` returning
    `{ canManage, loading }` where `canManage = isAppAdmin || isVillageAdmin(municipalityId) || isOrgAdmin(orgId)`.
    The org's `municipalityId` is read from the loaded org doc.

The edit button renders only when `canManage` is true. The edit route independently
redirects out when `canManage` is false (defense in depth — the button is not the
only gate), mirroring `app/village/[villageId]/community.tsx`.

Server-side writes are already gated by Firestore rules / callables; this change
only affects client affordances.

## Edit button (affordance)

New `apps/mobile/components/feature/FloatingEditButton.tsx`, styled to match
`FloatingBackButton.tsx` / `FloatingShareButton.tsx`, positioned top-right on the
hero detail screens. Takes an `onPress` (navigate to the edit route) and standard
floating-button props. Uses an `Ionicons` pencil/create icon at `iconSizes.md`.

Mounted on:
- `apps/mobile/app/o/[orgId].tsx`
- `apps/mobile/app/village/[villageId]/place/[placeId].tsx`
- `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx`

Each screen computes its capability (`useOrgCapabilities` / `useEntityCapabilities`)
and conditionally renders the button.

## Edit surface (reuse the creation form)

The creation flow is a single-page `ProposableForm`
(`apps/mobile/components/feature/proposable/ProposableForm.tsx`), not a stepper.
It is fully controlled — the parent owns all state — so it can be reused for
editing without modification.

Three new edit routes, each a thin screen that loads the entity, seeds form state,
renders `ProposableForm`, and submits via the `update*` path:

| Route | Loads via | Submits via |
|---|---|---|
| `app/o/[orgId]/edit.tsx` | `getOrganization` | `updateOrganization` (+ `uploadOrganizationImage` if image changed) |
| `app/village/[villageId]/place/[placeId]/edit.tsx` | `getPlace` | `updatePlace` (+ `uploadPlaceImage` if changed) |
| `app/village/[villageId]/barrio/[barrioId]/edit.tsx` | `getBarrio` | `updateBarrio` (+ `uploadBarrioImage` if changed) |

Each route:
1. Loads the entity (shows a spinner while loading; redirects/blank on not-found).
2. Guards on capability — `<Redirect>` out if `!canManage`.
3. Seeds local state (name, description, type/kind, existing `imageURL`) from the doc.
4. Renders a `ScreenHeader` (accent, title "Editar …") + `ProposableForm`.
5. On submit, calls `update*` with the changed fields; if the image changed,
   uploads via `upload*Image` and patches `imageURL`. On success, `router.back()`.

The submit handler mirrors each manager's existing `submit()` but targets the
update path instead of create/propose.

### Editable fields (mirror create exactly)

- **Org**: escudo image, `name`, `description`, `type` (`PROPOSABLE_ORGANIZATION_TYPES`).
- **Place**: image, `name`, `description`, `kind` (`PLACE_KINDS`).
- **Barrio**: image, `name`.

## i18n

New strings under the relevant namespaces (via `packages/i18n/messages/es.json`,
consumed with `useT()`): edit-button accessibility label and the three edit-screen
titles (e.g. `org.edit.title`, `place.edit.title`, `barrio.edit.title`). Reuse
existing create-form field labels — no new field strings needed.

## Testing

- `packages/shared` (vitest): `isOrgAdmin` — returns true for an admin member,
  false for a plain member / non-member. Cover the role-flag semantics.
- Mobile (jest): `useOrgCapabilities` capability resolution (app admin / village
  admin / org admin → true; plain member → false), if mockable at the hook level
  following existing `useEntityCapabilities` test patterns.
- The edit screens are largely UI wiring; where the submit handler has extractable
  logic (diffing image changed vs unchanged), prefer a small testable helper.
  Note in the PR any UI-only pieces that aren't unit-testable.

## Files touched (summary)

New:
- `apps/mobile/components/feature/FloatingEditButton.tsx`
- `apps/mobile/lib/auth/useOrgCapabilities.ts`
- `apps/mobile/app/o/[orgId]/edit.tsx`
- `apps/mobile/app/village/[villageId]/place/[placeId]/edit.tsx`
- `apps/mobile/app/village/[villageId]/barrio/[barrioId]/edit.tsx`

Modified:
- `packages/shared/src/services/orgMemberService.ts` (+ `isOrgAdmin`)
- `apps/mobile/app/o/[orgId].tsx` (mount edit button)
- `apps/mobile/app/village/[villageId]/place/[placeId].tsx` (mount edit button)
- `apps/mobile/app/village/[villageId]/barrio/[barrioId].tsx` (mount edit button)
- `packages/i18n/messages/es.json` (new strings)
- `packages/shared/src/services/_services-map.md` (if `isOrgAdmin` warrants a note)

## Open considerations

- Changing an org `type` or place `kind` after creation is allowed (matches the
  create form). If that turns out to be undesirable for approved entities, gate the
  chip picker behind `canManage`-only later — not in scope now.
- The route `app/o/[orgId]/edit.tsx` requires converting the current `o/[orgId].tsx`
  leaf into a directory route (`o/[orgId]/index.tsx` + `o/[orgId]/edit.tsx`) or using
  a flat `o/[orgId]/edit.tsx` sibling — verify Expo Router layout during planning.
