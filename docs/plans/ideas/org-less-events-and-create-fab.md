# Org-less events + context-aware create FAB

## Goal
Let any active village member create an event without belonging to an organization, and add a context-aware floating action button on the explore tab that routes to event- or news-creation depending on the active tab.

## Context
Today an event **requires** an organization at three layers: the model (`organizationId`/`organizationName` are required), the Firestore rules (`create` gated by `isOrgMember(organizationId)`), and the create UI (a non-org-member sees only "Request Organizer Status" / "Browse Organizations", never the form). There is no FAB anywhere in `apps/mobile`; event creation is reached only by navigation.

The user (Alvaro) wants, inspired by the ordago-apps explore tab's "create match" floating button:
1. Events creatable **without** an organization, attributed to the creating user.
2. A single-action, **context-aware** FAB on the explore tab: "eventos" tab → create event, "noticias" tab → create news.

News creation **already exists end to end** (model `NewsPostData`, service `createNewsPost`, rules under `/news/{postId}`, Cloud Functions, and the screen `apps/mobile/app/news/new.tsx`). So the news half of the FAB is purely a route to an existing screen — no new news infrastructure.

## Design / approach

### Part A — Allow events without an organization
- **Model** (`packages/shared/src/models/event/EventDataModel.ts`): `organizationId` and `organizationName` change from required `string` to `string | null`, mirroring how the News model already does `authorOrgId: string | null`. `createdBy` (already present) is the identity for org-less events.
- **Firestore rules** (`firestore.rules`, events block):
  - `create`: org event ⇒ `isOrgMember(organizationId)`; org-less event (`organizationId == null`) ⇒ `isVillageMember(municipalityId)`. Status stays `published` on create — **no approval queue**.
  - `update`/`delete`: add `isOwner(resource.data.createdBy)` to the existing `isOrgMember || isVillageAdmin || isAppAdmin`. Creator can edit/delete their own org-less event; village admins keep post-hoc delete (moderation by deletion).
  - `isValidEventCreate()`: relax the `isString(organizationId)` assertion to also accept `null` (and same for `organizationName`).
- **Service** (`packages/shared/src/services/eventService.ts`): `EventDataInput` / `createEvent` accept null org fields.
- **Create form** (`apps/mobile/app/event/new.tsx`): an active **village member** always sees the form. The org selector gains a **"Sin organización"** option, which is the default and the only choice when the user belongs to no orgs. The existing organizer-prompt buttons become a secondary hint rather than a hard gate.

### Part B — Context-aware create FAB on the explore tab
- New reusable `Fab` component under `apps/mobile/components/`, bottom-right, styled after ordago's create-match button.
- Mounted on the explore tab (`apps/mobile/app/(tabs)/index.tsx`). **Single action, context-aware:** active tab "eventos" → `router.push('/event/new')`; active tab "noticias" → `router.push('/news/new')`. Both targets already exist.
- The FAB shows on the explore tab unconditionally; the create screens enforce the active-village requirement downstream (as they already do).
- Web-compat: per the project's known RN-Web gotchas, keep styles on `style` (not `className`) for any `Animated` component, and verify the button renders on the Firebase Hosting web build.

## Out of scope
- No new `pending`/approval status for events — chosen model is open-create + moderate-by-delete.
- News creation flow itself — already built; the FAB only links to it.
- Speed-dial / multi-option FAB; FAB visibility gating per village state.

## Testing
- vitest in `packages/shared` for the model/service null-org changes.
- `@firebase/rules-unit-testing` e2e (`packages/shared/test/e2e/`) for the new rule branches: village-member-can-create-org-less, non-member-cannot, creator-can-update/delete-own org-less event, org path unchanged.
