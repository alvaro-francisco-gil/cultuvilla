import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  adminDoc,
  organizationDoc,
  organizationJoinRequestDoc,
  organizationMemberDoc,
} from '@cultuvilla/shared/firebase/refs/admin';
import { buildOrgMemberData } from '@cultuvilla/shared/models';
import { notifyJoinRequestResolved } from '../helpers/notifyRequests';

const db = admin.firestore();
const HANDLER = 'respondToJoinRequest';

interface RespondToJoinRequestData {
  requestId?: string;
  decision?: 'approved' | 'rejected';
}

interface RespondToJoinRequestResult {
  ok: true;
}

export const respondToJoinRequest = onCall<
  RespondToJoinRequestData,
  Promise<RespondToJoinRequestResult>
>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

    const { requestId, decision } = request.data;
    if (!requestId || (decision !== 'approved' && decision !== 'rejected')) {
      throw new HttpsError('invalid-argument', 'requestId and a valid decision are required.');
    }

    const reqRef = organizationJoinRequestDoc(db, requestId);

    let requesterUid = '';
    let orgId = '';
    let orgName = '';
    let municipalityId = '';

    await db.runTransaction(async (tx) => {
      // ── ALL reads first ────────────────────────────────────────────────
      const reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists) throw new HttpsError('not-found', 'Request not found.');
      const reqData = reqSnap.data();
      if (!reqData) throw new HttpsError('not-found', 'Request not found.');
      if (reqData.status !== 'pending') {
        throw new HttpsError('failed-precondition', 'Already resolved.');
      }

      orgId = reqData.orgId;
      requesterUid = reqData.userId;
      municipalityId = reqData.municipalityId;

      const callerMemberRef = organizationMemberDoc(db, orgId, uid);
      const appAdminRef = adminDoc(db, uid);
      const orgRef = organizationDoc(db, orgId);

      const [callerMemberSnap, appAdminSnap, orgSnap] = await Promise.all([
        tx.get(callerMemberRef),
        tx.get(appAdminRef),
        tx.get(orgRef),
      ]);

      const isOrgAdmin = callerMemberSnap.exists && callerMemberSnap.data()?.role === 'admin';
      if (!isOrgAdmin && !appAdminSnap.exists) {
        throw new HttpsError('permission-denied', 'Only an org admin may respond.');
      }

      orgName = orgSnap.data()?.name ?? orgId;

      // ── All writes after all reads ─────────────────────────────────────
      tx.update(reqRef, {
        status: decision,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: uid,
      });

      if (decision === 'approved') {
        const memberRef = organizationMemberDoc(db, orgId, requesterUid);
        tx.set(memberRef, buildOrgMemberData({ role: 'member' }));
      }
    });

    logger.info('join request resolved', { handler: HANDLER, requestId, decision, reviewedBy: uid });

    if (requesterUid && orgId && municipalityId) {
      await notifyJoinRequestResolved({
        orgId,
        orgName,
        municipalityId,
        requesterUid,
        decision,
      });
    }

    return { ok: true };
  },
);
