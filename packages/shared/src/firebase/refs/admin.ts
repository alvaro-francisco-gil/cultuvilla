// packages/shared/src/firebase/refs/admin.ts
import type { Firestore } from 'firebase-admin/firestore';
import { eventConverterAdmin } from '../converters/eventConverter';
import { registrationConverterAdmin } from '../converters/registrationConverter';
import { municipalityConverterAdmin } from '../converters/municipalityConverter';
import { barrioConverterAdmin } from '../converters/barrioConverter';
import { cemeteryConverterAdmin } from '../converters/cemeteryConverter';
import { villageMemberConverterAdmin } from '../converters/villageMemberConverter';
import { inviteTokenConverterAdmin } from '../converters/inviteTokenConverter';
import { joinRequestConverterAdmin } from '../converters/joinRequestConverter';
import { organizationConverterAdmin } from '../converters/organizationConverter';
import { orgMemberConverterAdmin } from '../converters/orgMemberConverter';
import { organizerRequestConverterAdmin } from '../converters/organizerRequestConverter';
import { personConverterAdmin } from '../converters/personConverter';

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

export const municipalityCemeteriesCollection = (db: Firestore, municipalityId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('cemeteries').withConverter(cemeteryConverterAdmin);

export const municipalityCemeteryDoc = (db: Firestore, municipalityId: string, cemeteryId: string) =>
  db.collection('municipalities').doc(municipalityId).collection('cemeteries').doc(cemeteryId).withConverter(cemeteryConverterAdmin);

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
