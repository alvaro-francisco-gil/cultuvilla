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
