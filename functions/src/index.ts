import * as admin from 'firebase-admin';
admin.initializeApp();

export { onRegistrationDeleted } from './waitlistPromotion';
export { completeExpiredEvents } from './eventCompletion';
export { onEventUpdated } from './notificationTriggers';
export { acceptInvite } from './acceptInvite';
export { updateCenso } from './updateCenso';
export { syncVillageDenormalization } from './syncVillageDenormalization';
export { onOccupationProposalApproved } from './onOccupationProposalApproved';
