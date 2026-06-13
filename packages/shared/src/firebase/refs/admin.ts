// packages/shared/src/firebase/refs/admin.ts
import type { Firestore } from 'firebase-admin/firestore';
import { eventConverterAdmin } from '../converters/eventConverter.admin';
import { registrationConverterAdmin } from '../converters/registrationConverter.admin';
import { municipalityConverterAdmin } from '../converters/municipalityConverter.admin';
import { barrioConverterAdmin } from '../converters/barrioConverter.admin';
import { placeConverterAdmin } from '../converters/placeConverter.admin';
import { villageMemberConverterAdmin } from '../converters/villageMemberConverter.admin';
import { inviteTokenConverterAdmin } from '../converters/inviteTokenConverter.admin';
import { joinRequestConverterAdmin } from '../converters/joinRequestConverter.admin';
import { organizationConverterAdmin } from '../converters/organizationConverter.admin';
import { orgMemberConverterAdmin } from '../converters/orgMemberConverter.admin';
import { organizerRequestConverterAdmin } from '../converters/organizerRequestConverter.admin';
import { personConverterAdmin } from '../converters/personConverter.admin';
import { userConverterAdmin } from '../converters/userConverter.admin';
import { notificationConverterAdmin } from '../converters/notificationConverter.admin';
import { newsPostConverterAdmin } from '../converters/newsPostConverter.admin';
import { newsCommentConverterAdmin } from '../converters/newsCommentConverter.admin';
import { newsReactionConverterAdmin } from '../converters/newsReactionConverter.admin';
import { newsReportConverterAdmin } from '../converters/newsReportConverter.admin';
import { occupationConverterAdmin } from '../converters/occupationConverter.admin';
import { occupationProposalConverterAdmin } from '../converters/occupationProposalConverter.admin';
import { adminConverterAdmin } from '../converters/adminConverter.admin';

export const eventsCollection = (db: Firestore) =>
  db.collection('events').withConverter(eventConverterAdmin);

export const eventDoc = (db: Firestore, eventId: string) =>
  db.collection('events').doc(eventId).withConverter(eventConverterAdmin);

export const eventRegistrationsCollection = (db: Firestore, eventId: string) =>
  db.collection('events').doc(eventId).collection('registrations').withConverter(registrationConverterAdmin);

export const eventRegistrationDoc = (db: Firestore, eventId: string, registrationId: string) =>
  db.collection('events').doc(eventId).collection('registrations').doc(registrationId).withConverter(registrationConverterAdmin);

// ── Municipality domain ────────────────────────────────────────────────────

export const municipalitiesCollection = (db: Firestore) =>
  db.collection('municipalities').withConverter(municipalityConverterAdmin);

export const municipalityDoc = (db: Firestore, municipalityId: string) =>
  db.collection('municipalities').doc(municipalityId).withConverter(municipalityConverterAdmin);

export const municipalityBarriosCollection = (db: Firestore, municipalityId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('barrios').withConverter(barrioConverterAdmin);

export const municipalityBarrioDoc = (db: Firestore, municipalityId: string, barrioId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('barrios').doc(barrioId).withConverter(barrioConverterAdmin);

export const municipalityPlacesCollection = (db: Firestore, municipalityId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('places').withConverter(placeConverterAdmin);

export const municipalityPlaceDoc = (db: Firestore, municipalityId: string, placeId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('places').doc(placeId).withConverter(placeConverterAdmin);

export const municipalityMembersCollection = (db: Firestore, municipalityId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('members').withConverter(villageMemberConverterAdmin);

export const municipalityMemberDoc = (db: Firestore, municipalityId: string, memberId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('members').doc(memberId).withConverter(villageMemberConverterAdmin);

export const municipalityInviteTokensCollection = (db: Firestore, municipalityId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('inviteTokens').withConverter(inviteTokenConverterAdmin);

export const municipalityInviteTokenDoc = (db: Firestore, municipalityId: string, tokenId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('inviteTokens').doc(tokenId).withConverter(inviteTokenConverterAdmin);

export const municipalityJoinRequestsCollection = (db: Firestore, municipalityId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('joinRequests').withConverter(joinRequestConverterAdmin);

export const municipalityJoinRequestDoc = (db: Firestore, municipalityId: string, requestId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('joinRequests').doc(requestId).withConverter(joinRequestConverterAdmin);

// ── Organization domain ──────────────────────────────────────────────────

export const organizationsCollection = (db: Firestore) =>
  db.collection('organizations').withConverter(organizationConverterAdmin);

export const organizationDoc = (db: Firestore, organizationId: string) =>
  db.collection('organizations').doc(organizationId).withConverter(organizationConverterAdmin);

export const organizationMembersCollection = (db: Firestore, organizationId: string) =>
  db.collection('organizations').doc(organizationId).collection('members').withConverter(orgMemberConverterAdmin);

export const organizationMemberDoc = (db: Firestore, organizationId: string, memberId: string) =>
  db.collection('organizations').doc(organizationId).collection('members').doc(memberId).withConverter(orgMemberConverterAdmin);

// ── Organizer requests ───────────────────────────────────────────────────

export const organizerRequestsCollection = (db: Firestore) =>
  db.collection('organizerRequests').withConverter(organizerRequestConverterAdmin);

export const organizerRequestDoc = (db: Firestore, requestId: string) =>
  db.collection('organizerRequests').doc(requestId).withConverter(organizerRequestConverterAdmin);

// ── Person domain ────────────────────────────────────────────────────────

export const personsCollection = (db: Firestore) =>
  db.collection('persons').withConverter(personConverterAdmin);

export const personDoc = (db: Firestore, personId: string) =>
  db.collection('persons').doc(personId).withConverter(personConverterAdmin);

// ── User + notifications domain ──────────────────────────────────────────

export const usersCollection = (db: Firestore) =>
  db.collection('users').withConverter(userConverterAdmin);

export const userDoc = (db: Firestore, userId: string) =>
  db.collection('users').doc(userId).withConverter(userConverterAdmin);

export const userNotificationsCollection = (db: Firestore, userId: string) =>
  db.collection('users').doc(userId).collection('notifications').withConverter(notificationConverterAdmin);

export const userNotificationDoc = (db: Firestore, userId: string, notificationId: string) =>
  db.collection('users').doc(userId).collection('notifications').doc(notificationId).withConverter(notificationConverterAdmin);

// ── News domain (top-level collections) ──────────────────────────────────

export const newsCollection = (db: Firestore) =>
  db.collection('news').withConverter(newsPostConverterAdmin);

export const newsDoc = (db: Firestore, postId: string) =>
  db.collection('news').doc(postId).withConverter(newsPostConverterAdmin);

export const newsCommentsCollection = (db: Firestore) =>
  db.collection('newsComments').withConverter(newsCommentConverterAdmin);

export const newsCommentDoc = (db: Firestore, commentId: string) =>
  db.collection('newsComments').doc(commentId).withConverter(newsCommentConverterAdmin);

export const newsReactionsCollection = (db: Firestore) =>
  db.collection('newsReactions').withConverter(newsReactionConverterAdmin);

export const newsReactionDoc = (db: Firestore, reactionId: string) =>
  db.collection('newsReactions').doc(reactionId).withConverter(newsReactionConverterAdmin);

export const newsReportsCollection = (db: Firestore) =>
  db.collection('newsReports').withConverter(newsReportConverterAdmin);

export const newsReportDoc = (db: Firestore, reportId: string) =>
  db.collection('newsReports').doc(reportId).withConverter(newsReportConverterAdmin);

// ── Occupation domain (top-level collections) ────────────────────────────

export const occupationsCollection = (db: Firestore) =>
  db.collection('occupations').withConverter(occupationConverterAdmin);

export const occupationDoc = (db: Firestore, occupationId: string) =>
  db.collection('occupations').doc(occupationId).withConverter(occupationConverterAdmin);

export const occupationProposalsCollection = (db: Firestore) =>
  db.collection('occupationProposals').withConverter(occupationProposalConverterAdmin);

export const occupationProposalDoc = (db: Firestore, proposalId: string) =>
  db.collection('occupationProposals').doc(proposalId).withConverter(occupationProposalConverterAdmin);

// ── Admin domain ─────────────────────────────────────────────────────────

export const adminsCollection = (db: Firestore) =>
  db.collection('admins').withConverter(adminConverterAdmin);

export const adminDoc = (db: Firestore, userId: string) =>
  db.collection('admins').doc(userId).withConverter(adminConverterAdmin);
