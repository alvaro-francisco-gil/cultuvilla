import * as admin from 'firebase-admin';
admin.initializeApp();

// Events
export { registerToEvent } from './events/registerToEvent';
export { completeExpiredEvents } from './events/eventCompletion';
export { onRegistrationDeleted } from './events/waitlistPromotion';
export { onEventUpdated } from './events/notificationTriggers';

// Village (memberships, organizer requests, invites, denormalization)
export { acceptInvite } from './village/acceptInvite';
export { requestJoinVillage } from './village/requestJoinVillage';
export { respondToJoinRequest } from './village/respondToJoinRequest';
export { requestOrganizeVillage } from './village/requestOrganizeVillage';
export { respondToOrganizerRequest } from './village/respondToOrganizerRequest';
export { syncVillageDenormalization } from './village/syncVillageDenormalization';

// Census (censo + occupation proposals)
export { updateCenso } from './census/updateCenso';
export { onOccupationProposalApproved } from './census/onOccupationProposalApproved';

// News (posts, moderation, reactions, comments)
export { moderateNewsPost } from './news/moderateNewsPost';
export { deleteNewsPost } from './news/deleteNewsPost';
export { setTrustedNewsAuthor } from './news/setTrustedNewsAuthor';
export { resolveNewsReport } from './news/resolveNewsReport';
export { syncNewsReactionCounts } from './news/syncNewsReactionCounts';
export { syncNewsCommentCount } from './news/syncNewsCommentCount';
