// Classifier for Cloud Function callable rejections and plain Errors thrown by
// the service layer. Maps an error into a normalized `kind` plus a Spanish
// headline + detail the UI can show as-is.
//
// Two-stage match:
//   1. Inspect `error.code` first — every cultuvilla callable throws an
//      `HttpsError` with a standard code (`unauthenticated`, `not-found`,
//      `failed-precondition`, …). This is the deterministic path.
//   2. Fall back to regex patterns against `error.message` only when the code
//      is unknown / missing. Patterns are case-insensitive.
//
// Taxonomy:
//   - 'stale-state' → cached doc diverged from server; UI should offer "Recargar"
//   - 'permission'  → user lacks role/identity to act; UI should explain
//   - 'capacity'    → resource is full; UI should explain
//   - 'network'     → request never landed; UI should offer retry
//   - 'unknown'     → not safely classifiable; fall back to bare alert

export type CallableErrorKind =
  | 'stale-state'
  | 'permission'
  | 'capacity'
  | 'network'
  | 'unknown';

export interface ClassifiedCallableError {
  kind: CallableErrorKind;
  /** Headline displayed to the user. Spanish, friendly. */
  headline: string;
  /** Suggested follow-up action / sub-copy. Spanish. */
  detail: string;
  /** The raw error code we matched on (Firebase HttpsError code, or empty). */
  matchedCode: string;
  /** The raw error message we matched on (for diagnostics, never user-facing). */
  matchedMessage: string;
}

// HttpsError code → kind. Cloud Functions callables throw with codes from the
// Firebase enum; this is the deterministic mapping.
//
// `functions/<code>` is the prefixed form seen on the client when an
// HttpsError reaches the SDK; we strip the prefix before lookup.
const CODE_TO_KIND: Record<string, CallableErrorKind | undefined> = {
  unauthenticated: 'permission',
  'permission-denied': 'permission',

  'not-found': 'stale-state',
  'failed-precondition': 'stale-state',
  'already-exists': 'stale-state',
  aborted: 'stale-state',

  'resource-exhausted': 'capacity',
  'out-of-range': 'capacity',

  unavailable: 'network',
  'deadline-exceeded': 'network',
  cancelled: 'network',

  // 'invalid-argument' deliberately omitted — usually indicates a client bug
  // we want surfaced, not classified as a user-facing condition. Falls through
  // to the message-pattern stage, then 'unknown'.
};

// Namespaced Firebase SDK codes. These are NOT HttpsError codes — they come
// from the Auth and Storage SDKs, whose failures reach the same UI surfaces as
// callable rejections (sign-in, image upload). Keyed on the FULL namespaced
// code because the bare segment is ambiguous: `auth/internal-error` is not the
// HttpsError `internal`, so stripping first would silently mis-bucket.
//
// Only codes with an unambiguous user-facing meaning are listed; anything else
// falls through to the message stage, then 'unknown'.
const NAMESPACED_CODE_TO_KIND: Record<string, CallableErrorKind | undefined> = {
  // Auth. `network-request-failed` is what a flaky connection throws during OTP
  // sign-in; unmapped, it reached the login screen as the raw developer string
  // "Firebase: Error (auth/network-request-failed)."
  'auth/network-request-failed': 'network',
  'auth/timeout': 'network',
  'auth/user-disabled': 'permission',
  'auth/requires-recent-login': 'permission',

  // Storage. A cover image uploading over a weak link exhausts the SDK's own
  // retry budget and throws `retry-limit-exceeded`.
  'storage/retry-limit-exceeded': 'network',
  'storage/canceled': 'network',
  'storage/server-file-wrong-size': 'network',
  'storage/unauthorized': 'permission',
  'storage/unauthenticated': 'permission',
  'storage/quota-exceeded': 'capacity',
};

// Message-pattern overrides. Used when the code path didn't match (e.g. the
// error came from a plain `throw new Error(...)` in a service helper, or the
// SDK lost the code on the way). Order matters — first match wins.
type Pattern = {
  match: RegExp | string;
  kind: CallableErrorKind;
};

const PATTERNS: readonly Pattern[] = [
  // Capacity-specific Spanish phrasing — keep these first so they outrank the
  // 'failed-precondition' bucket when the code is present and the phrasing
  // makes the capacity case unambiguous.
  { match: /lleno/i, kind: 'capacity' },
  { match: /no hay (?:hueco|sitio|plazas)/i, kind: 'capacity' },
  { match: /aforo completo/i, kind: 'capacity' },

  // Plain network-y strings the SDK sometimes surfaces without a code.
  { match: /failed to fetch/i, kind: 'network' },
  // Matches the prose spelling and the hyphenated code spelling that leaks into
  // messages as "Firebase: Error (auth/network-request-failed)." — the code
  // itself is sometimes dropped by the SDK, leaving only the message.
  { match: /network[- ]request[- ]failed/i, kind: 'network' },
  { match: /load failed/i, kind: 'network' },

  // Stale-state Spanish phrasing common to cultuvilla callables.
  { match: /ya tienes una solicitud pendiente/i, kind: 'stale-state' },
  { match: /ya eres miembro/i, kind: 'stale-state' },
  { match: /ya fue (?:moderado|resuelto|cancelado)/i, kind: 'stale-state' },
  { match: /la comunidad ya está activa/i, kind: 'stale-state' },
  { match: /el enlace de invitación (?:no es válido|ha expirado)/i, kind: 'stale-state' },

  // Permission phrasing.
  { match: /no autorizado/i, kind: 'permission' },
  { match: /sólo (?:el|los|la|las) /i, kind: 'permission' },
  { match: /solo (?:el|los|la|las) /i, kind: 'permission' },
  { match: /sólo superadmin/i, kind: 'permission' },
  { match: /debes iniciar sesión/i, kind: 'permission' },
];

const HEADLINES: Record<CallableErrorKind, { headline: string; detail: string }> = {
  'stale-state': {
    headline: 'Esto ha cambiado',
    detail: 'La información que estás viendo ya no está al día. Recarga para ver la última versión.',
  },
  permission: {
    headline: 'No puedes hacer eso',
    detail: 'No tienes permiso para realizar esta acción.',
  },
  capacity: {
    headline: 'No hay sitio',
    detail: 'No queda hueco para realizar esta acción.',
  },
  network: {
    headline: 'Sin conexión',
    detail: 'No hemos podido contactar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
  },
  unknown: {
    headline: 'Algo ha fallado',
    detail: 'No hemos podido completar la acción.',
  },
};

export function classifyCallableError(error: unknown): ClassifiedCallableError {
  const rawCode = extractRawCode(error);
  const message = extractMessage(error);

  const kind = classifyCode(rawCode) ?? classifyMessage(message);
  const { headline, detail } = HEADLINES[kind];
  // `matchedCode` stays the namespace-stripped form so it reads the same for
  // 'functions/permission-denied' and a server-side 'permission-denied'.
  return { kind, headline, detail, matchedCode: stripNamespace(rawCode), matchedMessage: message };
}

function extractRawCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const anyErr = error as { code?: unknown };
  return typeof anyErr.code === 'string' ? anyErr.code : '';
}

// Firebase client surfaces HttpsError codes as 'functions/permission-denied';
// server-side they're just 'permission-denied'.
function stripNamespace(code: string): string {
  const idx = code.indexOf('/');
  return idx >= 0 ? code.slice(idx + 1) : code;
}

function extractMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const anyErr = error as { message?: unknown; details?: unknown };
    if (typeof anyErr.message === 'string' && anyErr.message.length > 0) return anyErr.message;
    if (typeof anyErr.details === 'string' && anyErr.details.length > 0) return anyErr.details;
  }
  try {
    // Last-resort coercion; we tolerate "[object Object]" since the caller
    // already exhausted message/details extraction above.
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(error);
  } catch {
    return '';
  }
}

// The namespaced lookup runs first: an SDK code like 'auth/timeout' must not be
// resolved through the HttpsError table on its bare segment.
function classifyCode(rawCode: string): CallableErrorKind | null {
  if (!rawCode) return null;
  return NAMESPACED_CODE_TO_KIND[rawCode] ?? CODE_TO_KIND[stripNamespace(rawCode)] ?? null;
}

function classifyMessage(message: string): CallableErrorKind {
  if (!message) return 'unknown';
  for (const pattern of PATTERNS) {
    if (typeof pattern.match === 'string') {
      if (message.toLowerCase().includes(pattern.match.toLowerCase())) return pattern.kind;
    } else if (pattern.match.test(message)) {
      return pattern.kind;
    }
  }
  return 'unknown';
}
