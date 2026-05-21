# Services map

This is the catalogue of every backend-touching function in the app. **All Firebase access flows through this directory.** Components, pages, and hooks must call services here — no direct `firebase/*` imports outside this folder (the auth listener in `AuthContext.tsx` is the one documented exception). See [AGENTS.md](../../../../AGENTS.md) for the rule.

When you add a service, add it to this file in the same change. When you add a function to an existing service, update the row below.

> Collection paths: a leading `villages/{villageId}/...` means village-scoped (single-village writes/reads). Top-level paths (`users/`, `municipalities/`, `occupations/`, `admins/`) are app-wide. Cross-village reads use Firestore **collection group** queries (declared in `firestore.indexes.json`).

| Service | Owns collection(s) | What it does | Key entry points |
|---|---|---|---|
| [adminService](adminService.ts) | `admins/` | Check whether a user is a global superadmin. | `isAppAdmin` |
| [censoService](censoService.ts) | (callable) | Village censo / profile-schema utilities. Validates schema transitions, marks censo completion, calls the `updateCensoSchema` Cloud Function. | `validateSchemaTransition`, `missingRequiredAnswers`, `isCensoComplete`, `updateCensoSchema` |
| [eventService](eventService.ts) | `villages/{vid}/events/` | CRUD for events, status transitions, listing by village or organization. | `getEvent`, `getEventsByVillage`, `getEventsByOrganization`, `createEvent`, `updateEvent`, `updateEventStatus`, `deleteEvent` |
| [feedService](feedService.ts) | collection group `events` | Cross-village upcoming-events feed; haversine-based "nearby" filter. Read-only. | `getUpcomingFeed`, `haversineKm`, `filterByDistanceKm` |
| [imageService](imageService.ts) | Storage (`villages/`, `persons/`) | Upload/delete images with size+mime validation. | `uploadVillageImage`, `uploadPersonImage`, `deleteImageByURL` |
| [inviteTokenService](inviteTokenService.ts) | `villages/{vid}/inviteTokens/` | Village invite link tokens — create, validate, consume, accept. | `createInviteToken`, `validateInviteToken`, `consumeInviteToken`, `acceptInvite` |
| [joinRequestService](joinRequestService.ts) | `municipalities/{mid}/joinRequests/` + collection group | Village join requests — read your own, list per village (admins), create/respond via Cloud Function callables. | `getJoinRequest`, `getJoinRequestsForVillage`, `getMyJoinRequests`, `requestJoinVillage`, `respondToJoinRequest` |
| [organizerRequestService](organizerRequestService.ts) | `organizerRequests/` | Requests to become organizer of an inactive municipality. Users create + read own; superadmin lists pending; mutations via Cloud Function. | `getOrganizerRequest`, `getPendingOrganizerRequests`, `getMyOrganizerRequests`, `requestOrganizeVillage`, `respondToOrganizerRequest` |
| [membershipProfileService](membershipProfileService.ts) | `villages/{vid}/members/` (profile fields) | Writes user answers to a village's censo; sets `profileCompletedAt` when required fields are present. | `saveProfileAnswers`, `collectUsedValues`, `profileCompletedAtToDate` |
| [municipalityService](municipalityService.ts) | `municipalities/`, `municipalities/{id}/barrios/`, `municipalities/{id}/cemeteries/` | App-wide INE municipalities + nested barrios and cemeteries. CRUD. | `getMunicipalities`, `createMunicipality`, `getBarrios`, `createBarrio`, `getCemeteries`, `createCemetery`, plus updates/deletes |
| [notificationService](notificationService.ts) | `users/{uid}/notifications/` | In-app notification CRUD, unread counts, mark-as-read. | `getNotifications`, `getUnreadCount`, `createNotification`, `markAsRead`, `markAllAsRead` |
| [occupationService](occupationService.ts) | `occupations/`, `occupationProposals/` | App-wide occupation taxonomy; user-submitted proposals with admin review. | `getOccupations`, `createOccupation`, `proposeOccupation`, `getPendingProposals`, `reviewProposal` |
| [orgMemberService](orgMemberService.ts) | `villages/{vid}/organizations/{oid}/members/` | Add/remove/check org membership. | `getOrgMembers`, `addOrgMember`, `removeOrgMember`, `isOrgMember` |
| [organizationService](organizationService.ts) | `villages/{vid}/organizations/` | Org CRUD + request/approve/reject lifecycle (ayuntamiento, peña, asociación). | `getOrganization`, `getOrganizationsByVillage`, `requestOrganization`, `approveOrganization`, `rejectOrganization`, `updateOrganization`, `deleteOrganization` |
| [personService](personService.ts) | `persons/` | "Persona" profiles (proxy profiles, up to 50 per user) for family-member sign-ups. CRUD. | `getPerson`, `getPersonsByCreator`, `getPersonByUserId`, `createPerson`, `updatePerson`, `deletePerson` |
| [registrationService](registrationService.ts) | `events/{eid}/registrations/` + collection group | Event sign-ups for the user and their personas. `registerToEvent` is a thin wrapper around the `registerToEvent` callable Cloud Function (which runs the capacity-vs-waitlist decision in a transaction). The rest are reads. | `registerToEvent` (callable), `cancelRegistration`, `getEventRegistrations`, `getConfirmedCount`, `getUserRegistrations`, `getUserRegistrationsAcrossEvents`, `determineRegistrationStatus` |
| [userService](userService.ts) | `users/` | User profile CRUD, active-village setter. | `getUserProfile`, `getAllUsers`, `createUserProfile`, `updateUserProfile`, `setActiveVillage` |
| [villageMemberService](villageMemberService.ts) | `villages/{vid}/members/` + collection group | Village membership: add/remove, role checks, listing a user's villages. | `getVillageMember`, `getVillageMembers`, `addVillageMember`, `removeVillageMember`, `isVillageMember`, `isVillageAdmin`, `getUserMemberships` |
| [villageService](villageService.ts) | `villages/` | Village CRUD + slug-style ID generation. | `getVillage`, `getVillages`, `generateVillageId`, `createVillage`, `updateVillage`, `deleteVillage` |

## Denormalized fields

Some documents carry denormalized copies of fields owned by other collections so that high-fan-out reads can stay flat. These are kept in sync by Cloud Functions, not by client services. If you change one of the source-of-truth fields, the function listed below propagates it.

| Denormalized field | Lives on | Source of truth | Propagated by |
|---|---|---|---|
| `villageName`, `villageCoverImage`, `villageCoordinates` | `villages/{vid}/events/{eid}` | `villages/{vid}` | [functions/src/syncVillageDenormalization.ts](../../../../functions/src/syncVillageDenormalization.ts) |
| `displayName` on occupation usages | `persons/{pid}` (via `occupationIds`) | `occupations/{oid}` | [functions/src/onOccupationProposalApproved.ts](../../../../functions/src/onOccupationProposalApproved.ts) |
| `isMember` on each registration | `events/{eid}/registrations/{regId}` | `municipalities/{mid}/members/{userId}` | [functions/src/registerToEvent.ts](../../../../functions/src/registerToEvent.ts) (written at create time) |
| `confirmedCount`, `totalCount` on event doc | `events/{eid}` | aggregate over `events/{eid}/registrations/` | [functions/src/registerToEvent.ts](../../../../functions/src/registerToEvent.ts) + [functions/src/waitlistPromotion.ts](../../../../functions/src/waitlistPromotion.ts) |

See [docs/architecture/denormalized-read-models.md](../../../../docs/architecture/denormalized-read-models.md) for the pattern. If you introduce a new denormalized field, add a row above and a trigger in the same change.

## How to add a service

1. Create `packages/shared/src/services/{name}Service.ts`.
2. Export from [index.ts](index.ts).
3. Add a row to this file: collection it owns, what it does, key entry points.
4. If it denormalizes onto another doc, add the trigger and a row in the table above.
5. Consume from components/hooks via `@cultuvilla/shared/services/...`.
