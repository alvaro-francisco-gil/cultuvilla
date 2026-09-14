import { defineSecret } from 'firebase-functions/params';

/**
 * APNs token-auth credentials, as JSON: `{ "keyId": "ABC123DEFG", "privateKey":
 * "-----BEGIN PRIVATE KEY-----\n…" }` — the Key ID and the contents of the
 * `.p8` downloaded from the Apple Developer portal (Keys → Apple Push
 * Notifications service).
 *
 * One secret rather than two so the pair cannot be rotated half-way. The Team
 * ID is not secret (it is committed in the prod apple-app-site-association),
 * so it lives in code — see apnsTransport.ts.
 *
 * Must exist in each env's Secret Manager BEFORE the deploy that first binds
 * it: a bound secret that does not exist fails the whole `firebase deploy`.
 */
export const APNS_AUTH_KEY = defineSecret('APNS_AUTH_KEY');
