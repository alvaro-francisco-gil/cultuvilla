import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  adminDoc,
  municipalityMemberDoc,
  newsCommentDoc,
  newsReportDoc,
} from '@cultuvilla/shared/firebase/refs/admin';

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

    const { reportId, action } = request.data;
    if (!reportId || (action !== 'dismiss' && action !== 'remove')) {
      throw new HttpsError('invalid-argument', 'Argumentos inválidos.');
    }

    const reportRef = newsReportDoc(db, reportId);
    // Same typed ref reused for tx.update — partial + FieldValue sentinels
    // typecheck against UpdateData<NewsReportData> and bypass the converter.
    const reportRawRef = reportRef;

    await db.runTransaction(async (tx) => {
      const reportSnap = await tx.get(reportRef);
      if (!reportSnap.exists) throw new HttpsError('not-found', 'Reporte no encontrado.');

      // Converter-wrapped: typed NewsReportData.
      const report = reportSnap.data();
      if (!report) throw new HttpsError('not-found', 'Reporte no encontrado.');
      if (report.status !== 'open') {
        throw new HttpsError('failed-precondition', 'El reporte ya fue resuelto.');
      }

      const municipalityId = report.municipalityId;
      const callerMemberRef = municipalityMemberDoc(db, municipalityId, auth.uid);
      const appAdminRef = adminDoc(db, auth.uid);

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
        tx.update(reportRawRef, {
          status: 'dismissed',
          resolvedBy: auth.uid,
          resolvedAt: now,
        });
      } else {
        // action === 'remove': hide the target comment and mark report as actioned
        const commentRawRef = newsCommentDoc(db, report.targetId);
        tx.update(commentRawRef, { hidden: true });
        tx.update(reportRawRef, {
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
