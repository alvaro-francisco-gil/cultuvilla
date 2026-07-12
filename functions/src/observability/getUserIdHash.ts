import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { hashUserId } from '../shared/observability';
import { OBSERVABILITY_USER_ID_SALT } from './secret';

export const getUserIdHash = onCall(
  { region: 'us-central1', cors: true, secrets: [OBSERVABILITY_USER_ID_SALT] },
  (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    return { hash: hashUserId(request.auth.uid) };
  },
);
