# Open Feed Architecture — Design

**Date:** 2026-04-29
**Status:** Design approved, plan pending
**Supersedes structural decisions in:** `2026-04-05-cultuvilla-design.md` (event/org placement and home page behavior)

## 1. Vision

Villages stop being walled gardens. Events are global content; the village is a *facet* of an event (where it happens, who hosts), not its container. Anyone authenticated can sign up to any event. Membership stays meaningful — it gates censo, "from this village" visibility on attendee lists, and creating organizations — but it no longer gates participation. A user can be a member of one or a few villages. The default home page is a chronological feed of upcoming events from all villages, with an optional "Cerca de mí" filter.

The shift in framing: previous design treated each village as a tenant. The new framing treats events as the unit of value, and villages as a tag/scope on those events.

## 2. Data model

### 2.1 Final shape

```
villages/{villageId}                                 ← unchanged
villages/{villageId}/members/{userId}                ← stays nested (per-village relationship)
villages/{villageId}/inviteTokens/{tokenId}          ← stays nested

organizations/{orgId}                                ← MOVED to top-level
organizations/{orgId}/members/{userId}               ← stays nested under org

events/{eventId}                                     ← MOVED to top-level
events/{eventId}/registrations/{regId}               ← stays nested under event

users/{userId}                                       ← unchanged
users/{userId}/notifications/{nid}                   ← unchanged
admins/{userId}                                      ← unchanged
```

### 2.2 Why these placements

- **Members under villages**: a membership is a relationship intrinsic to (user, village). It carries role, censo answers, and joinedAt — all per-pair data. Nesting under the village makes "list this village's roster" a direct read and aligns with how village admins actually manage members.
- **Organizations top-level**: nesting an org under a village offers cascade-delete (which we do not use) and path-based rule access to `villageId` (replicable with one extra field read). It costs us cross-village queries, an indexing burden, and locks the door against future federated/multi-village orgs. Going top-level is cheap and keeps that door open at zero added complexity today.
- **Events top-level**: same reasoning as orgs, plus the product explicitly wants global event discovery. A flat `events` collection makes the feed query trivial and removes the need for collection-group indexes on events.
- **Registrations under events**: a registration's lifecycle is bounded by its event. Nesting is correct.
- **Org members under org**: org membership is intrinsic to (user, org). Same reasoning as village membership.

### 2.3 Event document — fields and denormalization

```ts
interface EventData {
  // intrinsic
  title: string;
  description: string;
  startDate: Timestamp;
  endDate: Timestamp | null;
  status: 'draft' | 'published' | 'cancelled';
  capacity: number | null;
  coverImage: string | null;
  organizationId: string;          // foreign key to top-level org
  createdBy: string;               // userId
  createdAt: Timestamp;

  // village context (denormalized for feed rendering)
  villageId: string;
  villageName: string;
  villageCoverImage: string | null;
  villageCoordinates: GeoPoint;
}
```

Denormalization rationale: the feed renders many events at once and each card needs the village name, image, and coordinates. Without these fields the feed page would issue N+1 reads per render (or require a separate cache layer). The fields are easy to keep in sync via a Cloud Function trigger on `villages/{id}` writes (rare, small scope). Stale data risk is bounded — village renames are rare and re-render after the trigger.

Trigger contract (Cloud Function):
- On update of `villages/{villageId}`: if `name`, `images[0]`, or `coordinates` changed, batch-update all `events` where `villageId == villageId` with the new values.

### 2.4 Organization document — fields

```ts
interface OrganizationData {
  name: string;
  type: 'ayuntamiento' | 'peña' | 'asociación';
  description: string;
  logoImage: string | null;
  villageId: string;               // single, today
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;             // userId who requested creation
  approvedBy: string | null;       // userId of village admin who approved
  createdAt: Timestamp;
  decidedAt: Timestamp | null;
}
```

No `parentOrgId` today. If/when multi-village orgs become a real product need, that field can be added without migrating any existing doc.

## 3. Membership semantics — capability matrix

| Capability | Member of village V | Authenticated, not a member of V |
|---|---|---|
| Browse any event in any village | ✓ | ✓ |
| Sign up to any event in any village | ✓ | ✓ |
| Cancel one's own registration | ✓ | ✓ |
| Fill V's censo (`profileAnswers`) | ✓ | — |
| Show as "Vecino de V" on attendee lists for V's events | ✓ | shown as "Visitante" |
| Request creation of an organization in V | ✓ | — |
| Be approved/added as a member of an org in V | ✓ | — |
| Become village admin of V (via app admin) | ✓ | — |

The `activeVillageId` field on the user doc is **demoted** but kept. It is a UI hint, not a security or routing primitive: it provides the default for "Cerca de mí" centering, the default village when an org member of multiple villages creates an event, and the censo nudge target. If a user has zero memberships, `activeVillageId` is null; the feed defaults to no center (or `navigator.geolocation` if granted).

## 4. Feed and routes

### 4.1 Routes after migration

```
/                                    Global feed (chronological, "Cerca de mí" toggle)
/village/{villageId}                  Village page (info + events filtered to that village)
/village/{villageId}/admin            Coordinador panel (unchanged)
/village/{villageId}/censo            Censo for this village (unchanged)
/event/{eventId}                      Event detail (was /village/{id}/event/{id})
/org/{orgId}                          Org page (was /village/{id}/org/{orgId})
/org/{orgId}/events/new              Create event (was nested)
/org/{orgId}/events/{eventId}/edit   Edit event (was nested)
/admin                                App admin (unchanged)
/profile                              Profile + "Mis pueblos" list (was active+switch)
/my-signups                           Unchanged (top-level collection-group on registrations)
/notifications                        Unchanged
/login, /complete-profile             Unchanged
/invite/{token}                       Unchanged (still village-scoped via token data)
```

Old nested routes (`/village/{id}/event/{eventId}`, `/village/{id}/org/{orgId}/...`) are removed outright. The product has no external links to preserve.

### 4.2 Feed query

```ts
query(
  collection(db, 'events'),
  where('status', '==', 'published'),
  where('startDate', '>=', Timestamp.now()),
  orderBy('startDate', 'asc'),
  limit(20)
)
```

Pagination: cursor-based (`startAfter(lastDoc)`).

### 4.3 "Cerca de mí" filter

Client-side haversine distance between `event.villageCoordinates` and the reference point. Reference point precedence:
1. The user's active village's `coordinates` if `activeVillageId` is set.
2. `navigator.geolocation` if granted.
3. None (filter is disabled in the UI; toggle is hidden).

No geohash, no server-side proximity. Justified by current scale — feed page returns 20 events at a time and a haversine call per event is trivial.

### 4.4 Village page (`/village/{villageId}`)

Reframed: this is no longer "the home for users of this village." It is a village info / discovery page:
- Village header (name, description, images, ubicación)
- Upcoming events filtered to this village (`where('villageId', '==', villageId)`)
- List of approved organizations
- "Soy vecino" / membership status (with link to censo if member but censo incomplete)
- For non-members: a CTA explaining what becoming a member grants (no signup gate; just informational)

## 5. Security rules

### 5.1 Top-level events

```
match /events/{eventId} {
  allow read: if true;
  allow create: if isAuthenticated()
                && isOrgMember(request.resource.data.organizationId)
                && request.resource.data.villageId is string
                && request.resource.data.organizationId is string;
  allow update: if isOrgMember(resource.data.organizationId)
                || isVillageAdmin(resource.data.villageId)
                || isAppAdmin();
  allow delete: if isOrgMember(resource.data.organizationId)
                || isVillageAdmin(resource.data.villageId)
                || isAppAdmin();

  match /registrations/{regId} {
    allow read: if true;
    allow create: if isAuthenticated()
                  && request.resource.data.userId == request.auth.uid;
    allow update: if isAuthenticated()
                  && resource.data.userId == request.auth.uid;
    allow delete: if isAuthenticated()
                  && resource.data.userId == request.auth.uid;
  }
}
```

### 5.2 Top-level organizations

```
match /organizations/{orgId} {
  allow read: if true;
  allow create: if isVillageMember(request.resource.data.villageId)
                || isAppAdmin();
  allow update: if isVillageAdmin(resource.data.villageId) || isAppAdmin();
  allow delete: if isVillageAdmin(resource.data.villageId) || isAppAdmin();

  match /members/{userId} {
    allow read: if true;
    allow create: if isOrgMember(orgId)
                  || isVillageAdmin(get(/databases/$(database)/documents/organizations/$(orgId)).data.villageId)
                  || isAppAdmin();
    allow delete: if isOwner(userId)
                  || isVillageAdmin(get(/databases/$(database)/documents/organizations/$(orgId)).data.villageId)
                  || isAppAdmin();
  }
}
```

### 5.3 Helper changes

`isOrgMember(orgId)` becomes a single lookup at `organizations/{orgId}/members/{uid}` (no longer needs `villageId`):
```
function isOrgMember(orgId) {
  return isAuthenticated() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
}
```

### 5.4 Removed rules

- `villages/{villageId}/organizations/...` — gone, collection no longer exists.
- `villages/{villageId}/events/...` — gone, collection no longer exists.
- Collection-group registrations rules continue to work; they now collection-group over `events/*/registrations` instead of `villages/*/events/*/registrations`.

### 5.5 Indexes

Removed: collection-group exemptions for `events` and `organizations` (no longer needed).
Kept: collection-group on `members` (`userId`) and `registrations` (`userId, registeredAt desc`).
Added: composite index on `events` (`status asc, startDate asc`) and `events` (`villageId asc, startDate asc`).

## 6. Migration plan

The codebase has minimal real data: a couple of test villages, a handful of test events at most, a single test user. Migration is overwhelmingly code-shaped, not data-shaped.

### 6.1 Order of operations

1. **Update shared models** — `EventDataModel`, `OrganizationDataModel` to include the new denormalized fields and remove path-implicit `villageId` parameters.
2. **Update shared services** — `eventService`, `organizationService`, `registrationService` to use top-level collections. Drop `villageId` from method signatures except where the value itself is needed.
3. **Add the village-data-sync trigger** as a Cloud Function (`onUpdate` on `villages/{id}`). Initially deploy it inert; it kicks in once events live at the new path.
4. **Migrate data** — one-shot script (`scripts/migrate-to-flat.mjs`) that:
   - Reads each `villages/{vid}/organizations/{oid}` doc, writes to `organizations/{oid}` with `villageId = vid` added.
   - Copies each `villages/{vid}/organizations/{oid}/members/{uid}` to `organizations/{oid}/members/{uid}`.
   - Reads each `villages/{vid}/events/{eid}` doc, writes to `events/{eid}` with denormalized village fields.
   - Copies each `villages/{vid}/events/{eid}/registrations/{rid}` to `events/{eid}/registrations/{rid}`.
   - Verifies counts match before issuing deletes of the old subtrees.
5. **Update rules** to the new shape; deploy.
6. **Update routes**:
   - Replace `app/page.tsx` (currently redirects authed users to active village) with the feed.
   - Add `app/event/[eventId]/page.tsx`, `app/org/[orgId]/page.tsx`, `app/org/[orgId]/events/new/page.tsx`, `app/org/[orgId]/events/[eventId]/edit/page.tsx`.
   - Delete `app/village/[id]/event/`, `app/village/[id]/org/`.
   - Reframe `app/village/[id]/page.tsx` as a village info page.
7. **Update profile page** to show `Mis pueblos` list (multiple memberships) instead of single active + switch. `activeVillageId` writes still happen but are de-emphasized in the UI.
8. **Update event detail** to render attendee badges (Vecino/Visitante) by reading `villages/{event.villageId}/members/{registrationUserId}` for each registration. One read per attendee — fine for typical attendee counts; revisit if events get >100 attendees.
9. **Delete the village-as-home redirect** logic from `app/page.tsx` and from `BottomNav` (any village-aware framing).
10. **Drop the now-unused collection-group index exemptions** from `firestore.indexes.json`; deploy.

### 6.2 Reversibility

The migration script writes to new locations before deleting old ones. If something goes wrong, the rollback is to redeploy the previous rules and code, leaving the new top-level docs as orphaned data that can be cleaned up later. Because there is no production user data, the practical risk is ~zero.

## 7. Censo's place in the new world

Censo is unchanged conceptually. It remains a per-village profile completion stored at `villages/{villageId}/members/{userId}.profileAnswers` / `profileCompletedAt`. The form definition stays at `villages/{villageId}.profileForm`.

UX shift driven by `activeVillageId` demotion:
- The censo nudge no longer assumes a single "your village." Instead, the profile page shows a "Mis pueblos" section listing each membership with a per-village censo status (complete / incomplete / x of y questions). Incomplete villages get a "Completar censo" link.
- A village page (`/village/{villageId}`) shown to a member with incomplete censo for *that* village displays an inline banner with the same CTA.
- No global modal; the nudge is contextual.

## 8. Explicit non-goals

- **Follows / following villages or organizations.** Not built. Revisit only if the chronological + geo feed becomes too noisy.
- **Multi-village organizations (`parentOrgId`, `villageIds[]`).** Door open (top-level orgs), feature deferred until a real use case appears.
- **Cross-village events (`coHostVillageIds[]`).** Door open, feature deferred.
- **Geohash / server-side proximity ranking.** Client-side haversine is sufficient.
- **Feed ranking, scoring, dedup.** Pure chronological. Geo is filter, not boost.
- **Backwards-compatible URLs** for old nested routes. No external links exist; clean break.

## 9. Open questions to revisit during implementation

- Whether the village-data-sync trigger should also fire on village `description` changes (probably not — feed cards don't show description).
- Whether `villageCoordinates` needs to be a `GeoPoint` field on event docs or two `lat`/`lng` numbers (`GeoPoint` is the right choice for parity with the village doc; verify Firestore client SDK ergonomics in feed code).
- Whether the village page should show "Eventos pasados" or only upcoming (probably upcoming for now; defer past-events archive).
