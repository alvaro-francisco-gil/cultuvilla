// packages/shared/src/firebase/refs/client.ts
import { collection, doc, type Firestore } from 'firebase/firestore';
import { eventConverterClient } from '../converters/eventConverter.client';
import { registrationConverterClient } from '../converters/registrationConverter.client';
import { municipalityConverterClient } from '../converters/municipalityConverter.client';
import { barrioConverterClient } from '../converters/barrioConverter.client';
import { placeConverterClient } from '../converters/placeConverter.client';
import { villageMemberConverterClient } from '../converters/villageMemberConverter.client';
import { inviteTokenConverterClient } from '../converters/inviteTokenConverter.client';
import { organizationConverterClient } from '../converters/organizationConverter.client';
import { orgMemberConverterClient } from '../converters/orgMemberConverter.client';
import { organizerRequestConverterClient } from '../converters/organizerRequestConverter.client';
import { personConverterClient } from '../converters/personConverter.client';
import { userConverterClient } from '../converters/userConverter.client';
import { notificationConverterClient } from '../converters/notificationConverter.client';
import { newsPostConverterClient } from '../converters/newsPostConverter.client';
import { newsCommentConverterClient } from '../converters/newsCommentConverter.client';
import { newsReactionConverterClient } from '../converters/newsReactionConverter.client';
import { newsReportConverterClient } from '../converters/newsReportConverter.client';
import { occupationConverterClient } from '../converters/occupationConverter.client';
import { occupationProposalConverterClient } from '../converters/occupationProposalConverter.client';
import { adminConverterClient } from '../converters/adminConverter.client';
import { organizationJoinRequestConverterClient } from '../converters/organizationJoinRequestConverter.client';
import { membershipEventConverterClient } from '../converters/membershipEventConverter.client';
import { festivalPosterConverterClient } from '../converters/festivalPosterConverter.client';

export const eventsCollection = (db: Firestore) =>
  collection(db, 'events').withConverter(eventConverterClient);

export const eventDoc = (db: Firestore, eventId: string) =>
  doc(db, 'events', eventId).withConverter(eventConverterClient);

export const eventRegistrationsCollection = (db: Firestore, eventId: string) =>
  collection(db, 'events', eventId, 'registrations').withConverter(registrationConverterClient);

export const eventRegistrationDoc = (db: Firestore, eventId: string, registrationId: string) =>
  doc(db, 'events', eventId, 'registrations', registrationId).withConverter(registrationConverterClient);

// Organizer-only contact info (phone) keyed by registration id. No converter:
// the payload is a small untyped `{ phone, name }` and the subcollection has no
// shared model. The factory exists so call sites stay off raw `doc(getDb(), …)`.
export const eventRegistrationContactDoc = (db: Firestore, eventId: string, registrationId: string) =>
  doc(db, 'events', eventId, 'registrationContacts', registrationId);

// ── Municipality domain ────────────────────────────────────────────────────

export const municipalitiesCollection = (db: Firestore) =>
  collection(db, 'municipalities').withConverter(municipalityConverterClient);

export const municipalityDoc = (db: Firestore, municipalityId: string) =>
  doc(db, 'municipalities', municipalityId).withConverter(municipalityConverterClient);

export const municipalityBarriosCollection = (db: Firestore, municipalityId: string) =>
  collection(db, 'municipalities', municipalityId, 'barrios').withConverter(barrioConverterClient);

export const municipalityBarrioDoc = (db: Firestore, municipalityId: string, barrioId: string) =>
  doc(db, 'municipalities', municipalityId, 'barrios', barrioId).withConverter(barrioConverterClient);

export const municipalityPlacesCollection = (db: Firestore, municipalityId: string) =>
  collection(db, 'municipalities', municipalityId, 'places').withConverter(placeConverterClient);

export const municipalityPlaceDoc = (db: Firestore, municipalityId: string, placeId: string) =>
  doc(db, 'municipalities', municipalityId, 'places', placeId).withConverter(placeConverterClient);

export const municipalityMembersCollection = (db: Firestore, municipalityId: string) =>
  collection(db, 'municipalities', municipalityId, 'members').withConverter(villageMemberConverterClient);

export const municipalityMemberDoc = (db: Firestore, municipalityId: string, memberId: string) =>
  doc(db, 'municipalities', municipalityId, 'members', memberId).withConverter(villageMemberConverterClient);

export const municipalityInviteTokensCollection = (db: Firestore, municipalityId: string) =>
  collection(db, 'municipalities', municipalityId, 'inviteTokens').withConverter(inviteTokenConverterClient);

export const municipalityInviteTokenDoc = (db: Firestore, municipalityId: string, tokenId: string) =>
  doc(db, 'municipalities', municipalityId, 'inviteTokens', tokenId).withConverter(inviteTokenConverterClient);

// ── Organization domain ──────────────────────────────────────────────────

export const organizationsCollection = (db: Firestore) =>
  collection(db, 'organizations').withConverter(organizationConverterClient);

export const organizationDoc = (db: Firestore, organizationId: string) =>
  doc(db, 'organizations', organizationId).withConverter(organizationConverterClient);

export const organizationMembersCollection = (db: Firestore, organizationId: string) =>
  collection(db, 'organizations', organizationId, 'members').withConverter(orgMemberConverterClient);

export const organizationMemberDoc = (db: Firestore, organizationId: string, memberId: string) =>
  doc(db, 'organizations', organizationId, 'members', memberId).withConverter(orgMemberConverterClient);

// ── Organizer requests ───────────────────────────────────────────────────

export const organizerRequestsCollection = (db: Firestore) =>
  collection(db, 'organizerRequests').withConverter(organizerRequestConverterClient);

export const organizerRequestDoc = (db: Firestore, requestId: string) =>
  doc(db, 'organizerRequests', requestId).withConverter(organizerRequestConverterClient);

// ── Person domain ────────────────────────────────────────────────────────

export const personsCollection = (db: Firestore) =>
  collection(db, 'persons').withConverter(personConverterClient);

export const personDoc = (db: Firestore, personId: string) =>
  doc(db, 'persons', personId).withConverter(personConverterClient);

// ── User + notifications domain ──────────────────────────────────────────

export const usersCollection = (db: Firestore) =>
  collection(db, 'users').withConverter(userConverterClient);

export const userDoc = (db: Firestore, userId: string) =>
  doc(db, 'users', userId).withConverter(userConverterClient);

export const userNotificationsCollection = (db: Firestore, userId: string) =>
  collection(db, 'users', userId, 'notifications').withConverter(notificationConverterClient);

export const userNotificationDoc = (db: Firestore, userId: string, notificationId: string) =>
  doc(db, 'users', userId, 'notifications', notificationId).withConverter(notificationConverterClient);

// ── News domain (top-level collections) ──────────────────────────────────

export const newsCollection = (db: Firestore) =>
  collection(db, 'news').withConverter(newsPostConverterClient);

export const newsDoc = (db: Firestore, postId: string) =>
  doc(db, 'news', postId).withConverter(newsPostConverterClient);

export const newsCommentsCollection = (db: Firestore) =>
  collection(db, 'newsComments').withConverter(newsCommentConverterClient);

export const newsCommentDoc = (db: Firestore, commentId: string) =>
  doc(db, 'newsComments', commentId).withConverter(newsCommentConverterClient);

export const newsReactionsCollection = (db: Firestore) =>
  collection(db, 'newsReactions').withConverter(newsReactionConverterClient);

export const newsReactionDoc = (db: Firestore, reactionId: string) =>
  doc(db, 'newsReactions', reactionId).withConverter(newsReactionConverterClient);

export const newsReportsCollection = (db: Firestore) =>
  collection(db, 'newsReports').withConverter(newsReportConverterClient);

export const newsReportDoc = (db: Firestore, reportId: string) =>
  doc(db, 'newsReports', reportId).withConverter(newsReportConverterClient);

export const festivalPostersCollection = (db: Firestore) =>
  collection(db, 'festivalPosters').withConverter(festivalPosterConverterClient);

export const festivalPosterDoc = (db: Firestore, posterId: string) =>
  doc(db, 'festivalPosters', posterId).withConverter(festivalPosterConverterClient);

// ── Occupation domain (top-level collections) ────────────────────────────

export const occupationsCollection = (db: Firestore) =>
  collection(db, 'occupations').withConverter(occupationConverterClient);

export const occupationDoc = (db: Firestore, occupationId: string) =>
  doc(db, 'occupations', occupationId).withConverter(occupationConverterClient);

export const occupationProposalsCollection = (db: Firestore) =>
  collection(db, 'occupationProposals').withConverter(occupationProposalConverterClient);

export const occupationProposalDoc = (db: Firestore, proposalId: string) =>
  doc(db, 'occupationProposals', proposalId).withConverter(occupationProposalConverterClient);

// ── Organization join requests ───────────────────────────────────────────

export const organizationJoinRequestsCollection = (db: Firestore) =>
  collection(db, 'organizationJoinRequests').withConverter(organizationJoinRequestConverterClient);

export const organizationJoinRequestDoc = (db: Firestore, id: string) =>
  doc(db, 'organizationJoinRequests', id).withConverter(organizationJoinRequestConverterClient);

// ── Membership audit log ─────────────────────────────────────────────────
// Append-only, top-level, scoped by `municipalityId`. Function-owned: clients
// only read (firestore.rules denies all client writes).

export const membershipEventsCollection = (db: Firestore) =>
  collection(db, 'membershipEvents').withConverter(membershipEventConverterClient);

export const membershipEventDoc = (db: Firestore, id: string) =>
  doc(db, 'membershipEvents', id).withConverter(membershipEventConverterClient);

// ── Admin domain ─────────────────────────────────────────────────────────

export const adminsCollection = (db: Firestore) =>
  collection(db, 'admins').withConverter(adminConverterClient);

export const adminDoc = (db: Firestore, userId: string) =>
  doc(db, 'admins', userId).withConverter(adminConverterClient);
