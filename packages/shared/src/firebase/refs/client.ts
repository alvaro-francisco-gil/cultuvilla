// packages/shared/src/firebase/refs/client.ts
import { collection, doc, type Firestore } from 'firebase/firestore';
import { eventConverterClient } from '../converters/eventConverter';
import { registrationConverterClient } from '../converters/registrationConverter';
import { municipalityConverterClient } from '../converters/municipalityConverter';
import { barrioConverterClient } from '../converters/barrioConverter';
import { cemeteryConverterClient } from '../converters/cemeteryConverter';
import { villageMemberConverterClient } from '../converters/villageMemberConverter';
import { inviteTokenConverterClient } from '../converters/inviteTokenConverter';
import { joinRequestConverterClient } from '../converters/joinRequestConverter';
import { organizationConverterClient } from '../converters/organizationConverter';
import { orgMemberConverterClient } from '../converters/orgMemberConverter';
import { organizerRequestConverterClient } from '../converters/organizerRequestConverter';
import { personConverterClient } from '../converters/personConverter';
import { userConverterClient } from '../converters/userConverter';
import { notificationConverterClient } from '../converters/notificationConverter';
import { newsPostConverterClient } from '../converters/newsPostConverter';
import { newsCommentConverterClient } from '../converters/newsCommentConverter';
import { newsReactionConverterClient } from '../converters/newsReactionConverter';
import { newsReportConverterClient } from '../converters/newsReportConverter';
import { occupationConverterClient } from '../converters/occupationConverter';
import { occupationProposalConverterClient } from '../converters/occupationProposalConverter';

export const eventsCollection = (db: Firestore) =>
  collection(db, 'events').withConverter(eventConverterClient);

export const eventDoc = (db: Firestore, eventId: string) =>
  doc(db, 'events', eventId).withConverter(eventConverterClient);

export const eventRegistrationsCollection = (db: Firestore, eventId: string) =>
  collection(db, 'events', eventId, 'registrations').withConverter(registrationConverterClient);

export const eventRegistrationDoc = (db: Firestore, eventId: string, registrationId: string) =>
  doc(db, 'events', eventId, 'registrations', registrationId).withConverter(registrationConverterClient);

// ── Municipality domain ────────────────────────────────────────────────────

export const municipalitiesCollection = (db: Firestore) =>
  collection(db, 'municipalities').withConverter(municipalityConverterClient);

export const municipalityDoc = (db: Firestore, municipalityId: string) =>
  doc(db, 'municipalities', municipalityId).withConverter(municipalityConverterClient);

export const municipalityBarriosCollection = (db: Firestore, municipalityId: string) =>
  collection(db, 'municipalities', municipalityId, 'barrios').withConverter(barrioConverterClient);

export const municipalityBarrioDoc = (db: Firestore, municipalityId: string, barrioId: string) =>
  doc(db, 'municipalities', municipalityId, 'barrios', barrioId).withConverter(barrioConverterClient);

export const municipalityCemeteriesCollection = (db: Firestore, municipalityId: string) =>
  collection(db, 'municipalities', municipalityId, 'cemeteries').withConverter(cemeteryConverterClient);

export const municipalityCemeteryDoc = (db: Firestore, municipalityId: string, cemeteryId: string) =>
  doc(db, 'municipalities', municipalityId, 'cemeteries', cemeteryId).withConverter(cemeteryConverterClient);

export const municipalityMembersCollection = (db: Firestore, municipalityId: string) =>
  collection(db, 'municipalities', municipalityId, 'members').withConverter(villageMemberConverterClient);

export const municipalityMemberDoc = (db: Firestore, municipalityId: string, memberId: string) =>
  doc(db, 'municipalities', municipalityId, 'members', memberId).withConverter(villageMemberConverterClient);

export const municipalityInviteTokensCollection = (db: Firestore, municipalityId: string) =>
  collection(db, 'municipalities', municipalityId, 'inviteTokens').withConverter(inviteTokenConverterClient);

export const municipalityInviteTokenDoc = (db: Firestore, municipalityId: string, tokenId: string) =>
  doc(db, 'municipalities', municipalityId, 'inviteTokens', tokenId).withConverter(inviteTokenConverterClient);

export const municipalityJoinRequestsCollection = (db: Firestore, municipalityId: string) =>
  collection(db, 'municipalities', municipalityId, 'joinRequests').withConverter(joinRequestConverterClient);

export const municipalityJoinRequestDoc = (db: Firestore, municipalityId: string, requestId: string) =>
  doc(db, 'municipalities', municipalityId, 'joinRequests', requestId).withConverter(joinRequestConverterClient);

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

// ── Occupation domain (top-level collections) ────────────────────────────

export const occupationsCollection = (db: Firestore) =>
  collection(db, 'occupations').withConverter(occupationConverterClient);

export const occupationDoc = (db: Firestore, occupationId: string) =>
  doc(db, 'occupations', occupationId).withConverter(occupationConverterClient);

export const occupationProposalsCollection = (db: Firestore) =>
  collection(db, 'occupationProposals').withConverter(occupationProposalConverterClient);

export const occupationProposalDoc = (db: Firestore, proposalId: string) =>
  doc(db, 'occupationProposals', proposalId).withConverter(occupationProposalConverterClient);
