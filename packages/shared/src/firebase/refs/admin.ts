// packages/shared/src/firebase/refs/admin.ts
import type { Firestore } from 'firebase-admin/firestore';
import { eventConverterAdmin } from '../converters/eventConverter.admin';
import { registrationConverterAdmin } from '../converters/registrationConverter.admin';
import { seatTokenConverterAdmin } from '../converters/seatTokenConverter.admin';
import { municipalityConverterAdmin } from '../converters/municipalityConverter.admin';
import { barrioConverterAdmin } from '../converters/barrioConverter.admin';
import { placeConverterAdmin } from '../converters/placeConverter.admin';
import { villageMemberConverterAdmin } from '../converters/villageMemberConverter.admin';
import { inviteTokenConverterAdmin } from '../converters/inviteTokenConverter.admin';
import { organizationConverterAdmin } from '../converters/organizationConverter.admin';
import { orgMemberConverterAdmin } from '../converters/orgMemberConverter.admin';
import { organizerRequestConverterAdmin } from '../converters/organizerRequestConverter.admin';
import { personConverterAdmin } from '../converters/personConverter.admin';
import { userConverterAdmin } from '../converters/userConverter.admin';
import { notificationConverterAdmin } from '../converters/notificationConverter.admin';
import { newsPostConverterAdmin } from '../converters/newsPostConverter.admin';
import { commentConverterAdmin } from '../converters/commentConverter.admin';
import { occupationConverterAdmin } from '../converters/occupationConverter.admin';
import { adminConverterAdmin } from '../converters/adminConverter.admin';
import { membershipEventConverterAdmin } from '../converters/membershipEventConverter.admin';
import { moderationEventConverterAdmin } from '../converters/moderationEventConverter.admin';
import { festivalPosterConverterAdmin } from '../converters/festivalPosterConverter.admin';
import { municipalityPersonConverterAdmin } from '../converters/municipalityPersonConverter.admin';
import { contentReportConverterAdmin } from '../converters/contentReportConverter.admin';
import { blockedUserConverterAdmin } from '../converters/blockedUserConverter.admin';

export const eventsCollection = (db: Firestore) =>
  db.collection('events').withConverter(eventConverterAdmin);

export const eventDoc = (db: Firestore, eventId: string) =>
  db.collection('events').doc(eventId).withConverter(eventConverterAdmin);

export const eventRegistrationsCollection = (db: Firestore, eventId: string) =>
  db.collection('events').doc(eventId).collection('registrations').withConverter(registrationConverterAdmin);

export const eventRegistrationDoc = (db: Firestore, eventId: string, registrationId: string) =>
  db.collection('events').doc(eventId).collection('registrations').doc(registrationId).withConverter(registrationConverterAdmin);

// Organizer-only private data for one registration: the phone (when the event
// sets telephoneRequired) plus the answers to the event's custom signupFields.
// Both are PII the public registration doc must never carry. No converter: the
// answer map is shaped by the event's field specs, not by a fixed model. The
// factory exists so call sites stay off raw `db.doc(...)`.
export const eventRegistrationPrivateDoc = (db: Firestore, eventId: string, registrationId: string) =>
  db.collection('events').doc(eventId).collection('registrationPrivate').doc(registrationId);

// Claim tokens for the event's open group seats. THE DOCUMENT ID IS THE SECRET
// — see SeatTokenModel. Never fold this collection into a query whose results
// reach a client that isn't the group owner or an organizer.
export const eventSeatTokensCollection = (db: Firestore, eventId: string) =>
  db.collection('events').doc(eventId).collection('seatTokens').withConverter(seatTokenConverterAdmin);

export const eventSeatTokenDoc = (db: Firestore, eventId: string, token: string) =>
  db.collection('events').doc(eventId).collection('seatTokens').doc(token).withConverter(seatTokenConverterAdmin);

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

export const municipalityPeopleCollection = (db: Firestore) =>
  db.collection('municipalityPeople').withConverter(municipalityPersonConverterAdmin);

export const municipalityPersonDoc = (db: Firestore, municipalityId: string, personId: string) =>
  db.collection('municipalityPeople').doc(`${municipalityId}_${personId}`).withConverter(municipalityPersonConverterAdmin);

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

// ── Comments (generic, entity-scoped, top-level) ────────────────────────

export const commentsCollection = (db: Firestore) =>
  db.collection('comments').withConverter(commentConverterAdmin);

export const commentDoc = (db: Firestore, commentId: string) =>
  db.collection('comments').doc(commentId).withConverter(commentConverterAdmin);

export const festivalPostersCollection = (db: Firestore) =>
  db.collection('festivalPosters').withConverter(festivalPosterConverterAdmin);

export const festivalPosterDoc = (db: Firestore, posterId: string) =>
  db.collection('festivalPosters').doc(posterId).withConverter(festivalPosterConverterAdmin);

// ── Occupation domain (top-level collections) ────────────────────────────

export const occupationsCollection = (db: Firestore) =>
  db.collection('occupations').withConverter(occupationConverterAdmin);

export const occupationDoc = (db: Firestore, occupationId: string) =>
  db.collection('occupations').doc(occupationId).withConverter(occupationConverterAdmin);

// ── Membership audit log ─────────────────────────────────────────────────
// Append-only, top-level, scoped by `municipalityId`. Function-owned: clients
// only read (firestore.rules denies all client writes).

export const membershipEventsCollection = (db: Firestore) =>
  db.collection('membershipEvents').withConverter(membershipEventConverterAdmin);

export const membershipEventDoc = (db: Firestore, id: string) =>
  db.collection('membershipEvents').doc(id).withConverter(membershipEventConverterAdmin);

// ── Moderation audit log ─────────────────────────────────────────────────
// Append-only, top-level, scoped by `municipalityId`. Function-owned: clients
// only read (firestore.rules denies all client writes). Sibling of
// `membershipEvents` — one log per concern (roles vs content).

export const moderationEventsCollection = (db: Firestore) =>
  db.collection('moderationEvents').withConverter(moderationEventConverterAdmin);

export const moderationEventDoc = (db: Firestore, id: string) =>
  db.collection('moderationEvents').doc(id).withConverter(moderationEventConverterAdmin);

// ── Admin domain ─────────────────────────────────────────────────────────

export const adminsCollection = (db: Firestore) =>
  db.collection('admins').withConverter(adminConverterAdmin);

export const adminDoc = (db: Firestore, userId: string) =>
  db.collection('admins').doc(userId).withConverter(adminConverterAdmin);

// ── UGC safety: reports + per-user block lists ───────────────────────────

export const contentReportsCollection = (db: Firestore) =>
  db.collection('contentReports').withConverter(contentReportConverterAdmin);

export const contentReportDoc = (db: Firestore, reportId: string) =>
  db.collection('contentReports').doc(reportId).withConverter(contentReportConverterAdmin);

export const userBlockedUsersCollection = (db: Firestore, userId: string) =>
  db.collection('users').doc(userId).collection('blockedUsers').withConverter(blockedUserConverterAdmin);

export const userBlockedUserDoc = (db: Firestore, userId: string, blockedUserId: string) =>
  db.collection('users').doc(userId).collection('blockedUsers').doc(blockedUserId).withConverter(blockedUserConverterAdmin);

/**
 * The OSM settlement reference data for one municipality, keyed by INE code.
 *
 * Under `_admin/**`, which is `allow read, write: if false` for every client —
 * no client reads this and the Admin SDK bypasses rules, so it needs no rules
 * of its own and cannot be edited into the barrios of every village activated
 * afterwards. (`_admin` paths need an EVEN number of segments to be a document;
 * this one is four.)
 */
export const settlementSeedDoc = (db: Firestore, codigoINE: string) =>
  db.collection('_admin').doc('settlements').collection('seeds').doc(codigoINE);
