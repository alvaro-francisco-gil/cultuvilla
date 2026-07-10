import { defineSecret } from 'firebase-functions/params';

/** HMAC salt for pseudonymizing user ids in telemetry. Server-side only. */
export const OBSERVABILITY_USER_ID_SALT = defineSecret('OBSERVABILITY_USER_ID_SALT');
