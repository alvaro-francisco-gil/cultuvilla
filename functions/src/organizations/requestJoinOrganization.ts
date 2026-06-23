import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import {
  organizationDoc, organizationMemberDoc, organizationJoinRequestsCollection,
} from '@cultuvilla/shared/firebase/refs/admin';
import { buildOrganizationJoinRequestData } from '@cultuvilla/shared/models';
import { notifyJoinRequestCreated } from '../helpers/notifyRequests';

const db = admin.firestore();
const HANDLER = 'requestJoinOrganization';

interface Data { orgId?: string }
interface Result { ok: true; requestId: string }

export const requestJoinOrganization = onCall<Data, Promise<Result>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
    const orgId = request.data.orgId;
    if (!orgId) throw new HttpsError('invalid-argument', 'orgId is required.');

    const orgSnap = await organizationDoc(db, orgId).get();
    if (!orgSnap.exists) throw new HttpsError('not-found', 'Organization not found.');
    const org = orgSnap.data();
    if (!org) throw new HttpsError('not-found', 'Organization not found.');
    if (org.status !== 'approved') throw new HttpsError('failed-precondition', 'Organization not approved.');

    const memberSnap = await organizationMemberDoc(db, orgId, uid).get();
    if (memberSnap.exists) throw new HttpsError('already-exists', 'Already a member.');

    const dup = await organizationJoinRequestsCollection(db)
      .where('userId', '==', uid).where('orgId', '==', orgId).where('status', '==', 'pending').limit(1).get();
    if (!dup.empty) throw new HttpsError('already-exists', 'A pending request already exists.');

    const ref = organizationJoinRequestsCollection(db).doc();
    await ref.set(buildOrganizationJoinRequestData({ userId: uid, orgId, municipalityId: org.municipalityId }));

    logger.info('join request created', { handler: HANDLER, orgId, requesterUid: uid, requestId: ref.id });
    await notifyJoinRequestCreated({ orgId, orgName: org.name, municipalityId: org.municipalityId, requesterUid: uid });
    return { ok: true, requestId: ref.id };
  },
);
