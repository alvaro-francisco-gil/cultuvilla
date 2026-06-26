# Municipality vs. village

One physical entity, two layers. This is the single most load-bearing naming
distinction in the codebase — read it before adding a field or collection that
touches either word.

## The two layers

| | **Municipality** (physical / identity layer) | **Village** (community / display layer) |
|---|---|---|
| What it is | The canonical Spanish administrative unit, INE-coded. Always exists (≈8k seeded). | A municipality *once its `community` overlay is activated* by a group of users. |
| Lifecycle | Immutable reference data, seeded once. | Created when `community != null` / `communityActive == true`. |
| Source of truth | `municipalities/{id}` doc (`name`, `province`, `coordinates`, `codigoINE`, `escudo*`). | The `community` subfield on that same doc (`description`, `adminUserId`, `profileForm`, `activatedAt`). |

A municipality **becomes** a village the moment its community is activated.
There is at most one community per municipality — the 1:1 invariant is enforced
structurally by storing the community *inside* the municipality doc, not in a
separate collection. **There is no `villages/` Firestore collection.**

## The naming rule

> **Identity / storage / foreign keys → `municipality`. Community-facing content / display → `village`.**

Apply it consistently:

| Use | Layer | Name |
|---|---|---|
| Firestore collection | physical | `municipalities/{id}` |
| Foreign key on any doc | physical | `municipalityId` |
| Storage prefix | physical (keyed by the id) | `municipalities/{municipalityId}/…` |
| Members subcollection | community | `municipalities/{id}/members` → `VillageMemberData` (you're a member of the *community*, not of a polygon) |
| The activated overlay | community | `VillageCommunity`, `community` subfield |
| Denormalized display fields on events | community | `event.villageName`, `event.villageCoverImage`, `event.villageCoordinates` (copied from the municipality by `syncVillageDenormalization`) |
| Cloud Functions over the community | community | `startVillage`, `updateVillageInfo`, `syncVillageDenormalization`, `requestOrganizeVillage` |

Note that `event.municipalityId` (which municipality the event belongs to — a
foreign key) and `event.villageName` (what to render in the feed — community
display) sit side by side on the same doc *by design*: different layers.

## Known gray areas (intentionally left as `municipality`)

A handful of local variables / function params hold a municipality doc's `name`
for a notification body or the app header (e.g. `notifyRequests`’ input,
`AppHeader`’s state). They read `municipalityData.name` directly, so they keep
the `municipality` name even though the rendered value is the village's name.
These are reads of the physical doc, not the denormalized community field, so
the boundary is consistent — not worth churning.

## Why it was worth fixing

The codebase had drifted: docs described a `villageService` / `villages/`
collection that never existed, event display fields were named `municipality*`
while the UI and docs called them `village*`, and Storage used a `villages/`
prefix while Firestore used `municipalities/`. The layered rule above resolves
all of it. See [denormalized-read-models.md](./denormalized-read-models.md) for
how the `village*` display fields are kept in sync.
