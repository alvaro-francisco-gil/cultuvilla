import { randomBytes } from 'node:crypto';

/**
 * Bytes of entropy behind a seat-claim token. The token IS the authorization
 * to take a held seat, and the document id it becomes is only as guessable as
 * this: 24 bytes (192 bits) puts a brute-force search far out of reach while
 * still fitting comfortably in a shareable URL.
 */
const SEAT_TOKEN_BYTES = 24;

/** base64url so the token drops straight into a path segment unescaped. */
export function generateSeatToken(): string {
  return randomBytes(SEAT_TOKEN_BYTES).toString('base64url');
}

/** Cheap shape guard before spending a read on a caller-supplied token. */
export function isWellFormedSeatToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(value);
}
