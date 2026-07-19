// Must be the first import: initializes the Admin SDK before any handler module
// (which call getFirestore() at top-level) evaluates. See initApp.ts.
import './initApp';

// Events
export { registerToEvent } from './events/registerToEvent';
export { addWalkInRegistration } from './events/addWalkInRegistration';
export { completeExpiredEvents } from './events/eventCompletion';
export { onRegistrationDeleted } from './events/waitlistPromotion';
export { onEventUpdated } from './events/notificationTriggers';

// Village (memberships, organizer requests, invites, denormalization)
export { acceptInvite } from './village/acceptInvite';
export { startVillage } from './village/startVillage';
export { updateVillageInfo } from './village/updateVillageInfo';
export { requestOrganizeVillage } from './village/requestOrganizeVillage';
export { respondToOrganizerRequest } from './village/respondToOrganizerRequest';
export { changeVillageMemberRole } from './village/changeVillageMemberRole';
export { syncVillageDenormalization } from './village/syncVillageDenormalization';
export { syncMemberBarrioToResidence } from './village/syncMemberBarrioToResidence';
export { syncBarrioResidentCount } from './village/syncBarrioResidentCount';
export { syncPlaceBurialCount } from './village/syncPlaceBurialCount';

// Organizations (ayuntamiento singleton enforcement)
export { requestAyuntamiento } from './organizations/requestAyuntamiento';
export { approveOrganization } from './organizations/approveOrganization';
export { changeOrgMemberRole } from './organizations/changeOrgMemberRole';
export { syncOrgMemberCount } from './organizations/syncOrgMemberCount';
export { onOrganizationUpdated } from './organizations/notificationTriggers';

// Census (censo)
export { updateCenso } from './census/updateCenso';

// Users (profile + persona denormalization)
export { syncPersonDenormalization } from './users/syncPersonDenormalization';

// Account (deletion lifecycle)
export { checkAccountDeletable } from './account/checkAccountDeletable';
export { deleteAccount } from './account/deleteAccount';

// News (posts)
export { deleteNewsPost } from './news/deleteNewsPost';

// Content moderation (hide/unhide across news, festival posters, barrios, places)
export { setContentVisibility } from './moderation/setContentVisibility';

// Interaction (entity comment count sync + view count callable, entityKind-routed)
export { syncEntityCommentCount } from './interaction/syncEntityInteractionCounts';
export { recordEntityView } from './interaction/recordEntityView';

// Share-link Open Graph preview renderer (HTTPS function behind a Hosting rewrite).
export { ogRenderer } from './og/render';

// Maps (Google Static Maps proxy + geocoding — key stays server-side)
export { staticMap } from './maps/staticMap';
export { geocodeSearch } from './maps/geocodeSearch';

// Auth (branded sign-in email delivery via Resend)
export { sendAuthSignInEmail } from './auth/sendAuthSignInEmail';

// Observability (client error ingestion + pseudonymized identity)
export { logClientError } from './observability/logClientError';
export { getUserIdHash } from './observability/getUserIdHash';
