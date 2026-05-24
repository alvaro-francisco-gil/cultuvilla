import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const db = admin.firestore();

interface ResolveNewsReportData {
  reportId?: string;
  action?: 'dismiss' | 'remove';
}

interface ResolveNewsReportResult {
  ok: true;
}

export const resolveNewsReport = onCall<ResolveNewsReportData, Promise<ResolveNewsReportResult>>(
  { region: 'us-central1', cors: true },
  async (request) => {
    const handler = 'resolveNewsReport';
    const auth = request.auth;
    if (!auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

    const { reportId, action } = request.data ?? {};
    if (!reportId || (action !== 'dismiss' && action !== 'remove')) {
      throw new HttpsError('invalid-argument', 'Argumentos inválidos.');
    }

    const reportRef = db.doc(`newsReports/${reportId}`);

    await db.runTransaction(async (tx) => {
      const reportSnap = await tx.get(reportRef);
      if (!reportSnap.exists) throw new HttpsError('not-found', 'Reporte no encontrado.');

      if (reportSnap.get('status') !== 'open') {
        throw new HttpsError('failed-precondition', 'El reporte ya fue resuelto.');
      }

      const municipalityId = reportSnap.get('municipalityId') as string;
      const callerMemberRef = db.doc(`municipalities/${municipalityId}/members/${auth.uid}`);
      const appAdminRef = db.doc(`admins/${auth.uid}`);

      const [callerMemberSnap, appAdminSnap] = await Promise.all([
        tx.get(callerMemberRef),
        tx.get(appAdminRef),
      ]);

      const isVillageAdmin = callerMemberSnap.exists && callerMemberSnap.get('role') === 'admin';
      const isAppAdmin = appAdminSnap.exists;

      if (!isVillageAdmin && !isAppAdmin) {
        throw new HttpsError('permission-denied', 'No autorizado.');
      }

      const now = FieldValue.serverTimestamp();

      if (action === 'dismiss') {
        tx.update(reportRef, {
          status: 'dismissed',
          resolvedBy: auth.uid,
          resolvedAt: now,
        });
      } else {
        // action === 'remove': hide the target comment and mark report as actioned
        const targetId = reportSnap.get('targetId') as string;
        const commentRef = db.doc(`newsComments/${targetId}`);
        tx.update(commentRef, { hidden: true });
        tx.update(reportRef, {
          status: 'actioned',
          resolvedBy: auth.uid,
          resolvedAt: now,
        });
      }
    });

    logger.info('resolved news report', { handler, reportId, action });
    return { ok: true };
  },
);
