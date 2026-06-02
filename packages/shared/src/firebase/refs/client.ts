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
