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
export { syncVillageDenormalization } from './village/syncVillageDenormalization';

// Organizations (ayuntamiento singleton enforcement)
export { requestAyuntamiento } from './organizations/requestAyuntamiento';

// Census (censo + occupation proposals)
export { updateCenso } from './census/updateCenso';
export { onOccupationProposalApproved } from './census/onOccupationProposalApproved';

// Users (profile + persona denormalization)
export { syncPersonDenormalization } from './users/syncPersonDenormalization';

// News (posts, moderation, reactions, comments)
export { moderateNewsPost } from './news/moderateNewsPost';
export { deleteNewsPost } from './news/deleteNewsPost';
export { setTrustedNewsAuthor } from './news/setTrustedNewsAuthor';
export { resolveNewsReport } from './news/resolveNewsReport';
export { syncNewsReactionCounts } from './news/syncNewsReactionCounts';
export { syncNewsCommentCount } from './news/syncNewsCommentCount';
