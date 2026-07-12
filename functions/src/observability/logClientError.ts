import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { log, redactPII } from '../shared/observability';
import { OBSERVABILITY_USER_ID_SALT } from './secret';

const handler = 'logClientError';

// Only these keys are allowed out of a client payload into the log record.
// `message` is redacted; everything else is a bounded scalar.
function pickClientErrorAttrs(uid: string, data: unknown): Record<string, unknown> {
  const d = (data ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v.slice(0, 500) : undefined);
  return {
    handler,
    'user.id': uid, // raw here; hashed by transformAttrs inside log.error
    'error.message': typeof d.message === 'string' ? redactPII(d.message.slice(0, 500)) : undefined,
    'error.name': str(d.name),
    'error.stack': str(d.stack),
    route: str(d.route),
    appVersion: str(d.appVersion),
    platform: str(d.platform),
    operation_id: str(d.operation_id),
  };
}

/** Core logic, separated from the onCall envelope so it is unit-testable. */
export function runLogClientError(uid: string, data: unknown): void {
  log.error('client error', pickClientErrorAttrs(uid, data));
}

export const logClientError = onCall(
  { region: 'us-central1', cors: true, secrets: [OBSERVABILITY_USER_ID_SALT] },
  (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    runLogClientError(request.auth.uid, request.data);
    return { ok: true as const };
  },
);
