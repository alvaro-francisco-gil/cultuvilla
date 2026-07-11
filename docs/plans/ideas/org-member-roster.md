# Organization member roster with privacy toggle

## Goal

Show a roster of a group's (organization's) members on the org detail screen — avatar + name rows in the same style as the event sign-up list — gated by a per-group privacy toggle set at creation (default on).

## Context

Events show who signed up via [`EventAttendees`](../../../apps/mobile/components/feature/EventAttendees.tsx) (avatar + name rows from `getEventRegistrations`). Organizations have members at `organizations/{orgId}/members/{uid}` but the detail screen ([`o/[orgId]/index.tsx`](../../../apps/mobile/app/o/[orgId]/index.tsx)) today renders **only a member count** — never the members themselves. We want a matching roster for groups, plus a privacy switch so a group can choose whether that roster is shown publicly.

Unlike event registrations (which denormalize `name`), org member docs store only `userId`, `role`, `joinedAt`. A roster must therefore resolve each member's display name + photo from their `userId`.

## Design / approach

### Visibility semantics (decided)

A boolean `membersPublic` on the organization (default `true`):

- `true` → roster visible to **everyone** (members, non-members, visitors).
- `false` → roster visible **only to joined members** (admins are members, so they always see it). Non-member visitors see just the count, as today.

Expressed as a pure predicate `canViewOrgRoster({ membersPublic, isMember }) = membersPublic || isMember`.

### Enforcement level (decided): display gate only

`membersPublic` is a **UI display preference**, not a hard security boundary. The roster component renders only when `canViewOrgRoster(...)` is true; nothing changes in Firestore rules or the count path. This is deliberate and sufficient: member identities (names via world-readable `users/{uid}`, photos via world-readable `persons/{personId}`) are already publicly readable, so rules-enforcing only the members subcollection would be a false sense of security while buying meaningful extra machinery (a denormalized `memberCount` + Cloud Function trigger to replace the now-unreadable aggregate count). Rules-level enforcement is explicitly **out of scope** — see below.

### Member name + photo resolution

For each member `uid`, resolve in one hop via `getPersonByUserId(uid)` (returns name parts + `photoURL`). Fallback when no linked person exists: `getUserProfile(uid).displayName` + initials avatar. Mirrors how `EventAttendees` resolves attendee photos per-row.

### Data model

[`OrganizationDataModel.ts`](../../../packages/shared/src/models/organization/OrganizationDataModel.ts):
- Add `membersPublic: boolean` to `OrganizationDataSchema` and `OrganizationDataInput`.
- `buildOrganizationData` defaults it to `true`.

The strict Zod converter throws on docs missing a newly-added field, so existing dev orgs must be backfilled in the same change (idempotent `scripts/backfill-org-members-public.mjs` setting `membersPublic: true` on orgs missing it), and org seed fixtures updated. Verify with `pnpm check:dev-conformance` before/after.

### Creation form

[`OrganizationsManager.tsx`](../../../apps/mobile/components/feature/proposable/OrganizationsManager.tsx): add a toggle row (label "show group members", default ON) alongside the `ProposableForm`, threading `membersPublic` into the `requestOrganization` input. [`organizationService.ts`](../../../packages/shared/src/services/organizationService.ts) `requestOrganization` writes `membersPublic` into the doc.

### Edit form

[`o/[orgId]/edit.tsx`](../../../apps/mobile/app/o/[orgId]/edit.tsx): the same toggle, persisted via `updateOrganization`.

### Roster component

New `OrgMembersList` component (mirrors `EventAttendees` style): `getOrgMembers(orgId)` → per member resolve name + photo as above → render `Avatar` + name + a small admin badge when `role === 'admin'`. Read-only, admins-first then by name, with loading + empty states.

### Detail screen

[`o/[orgId]/index.tsx`](../../../apps/mobile/app/o/[orgId]/index.tsx): keep the existing count line; render `<OrgMembersList>` beneath it only when `canViewOrgRoster({ membersPublic: org.membersPublic, isMember })`.

### i18n

Add strings to `packages/i18n/messages/es.json`: toggle label + helper text, roster heading, admin badge, empty state.

### Tests (vitest, `packages/shared/test/`)

- `buildOrganizationData` defaults `membersPublic: true`.
- `OrganizationDataSchema` parse round-trip including `membersPublic`.
- `canViewOrgRoster` truth table.

## Out of scope

- **Rules-enforced privacy (Approach B).** Locking the members-subcollection read rule + denormalizing `memberCount`. Not pursued — the underlying profile docs stay world-readable, so it adds machinery without real privacy. Not a planned follow-up.
- **Villages.** This applies to organizations only; villages are a separate membership surface.
- **Member removal / management actions** in the roster. Read-only. Role changes stay in their existing audited callables.

## Open questions

None.
