// Picks the message the auth screens render in their inline `<Text tone="danger">`.
//
// The auth screens can't use `showCallableError` — that surface is an Alert, and
// login shows its error inline under the input. This is the same decision logic,
// reduced to a pure function so it can be tested without rendering.
//
// Three sources compete, in this order:
//   1. A confident `classifyCallableError` kind — the only path that turns a
//      dropped request into "Sin conexión" rather than an SDK dump.
//   2. The error's own message, when it is server-authored Spanish (callables
//      throw HttpsError with copy like 'Código incorrecto o caducado.', which
//      beats any generic fallback).
//   3. The caller's i18n fallback.

import { classifyCallableError } from '@cultuvilla/shared/services/callableErrors';

// Firebase SDK messages ("Firebase: Error (auth/network-request-failed).") are
// developer strings. They are never user copy, even though they are in the
// `message` field, so they must not reach the screen.
const SDK_MESSAGE_RE = /^\s*Firebase:/i;

// Sentinels AuthContext throws for empty/invalid local input. They exist for
// control flow, not display — rendering them leaks 'email-required' to the user.
const INTERNAL_SENTINELS = new Set(['email-required', 'not-signed-in']);

export function authErrorMessage(error: unknown, fallback: string): string {
  const classified = classifyCallableError(error);
  if (classified.kind !== 'unknown') return classified.detail;

  const message = classified.matchedMessage.trim();
  if (!message) return fallback;
  if (SDK_MESSAGE_RE.test(message)) return fallback;
  if (INTERNAL_SENTINELS.has(message)) return fallback;
  return message;
}
