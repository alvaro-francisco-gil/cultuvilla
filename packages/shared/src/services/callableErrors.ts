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
const CODE_TO_KIND: Record<string, CallableErrorKind> = {
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
  { match: /network request failed/i, kind: 'network' },
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
  const code = extractCode(error);
  const message = extractMessage(error);

  const kind = classifyCode(code) ?? classifyMessage(message);
  const { headline, detail } = HEADLINES[kind];
  return { kind, headline, detail, matchedCode: code, matchedMessage: message };
}

function extractCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const anyErr = error as { code?: unknown };
  if (typeof anyErr.code !== 'string') return '';
  // Firebase client surfaces HttpsError codes as 'functions/permission-denied';
  // server-side they're just 'permission-denied'. Normalize.
  const raw = anyErr.code;
  const idx = raw.indexOf('/');
  return idx >= 0 ? raw.slice(idx + 1) : raw;
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

function classifyCode(code: string): CallableErrorKind | null {
  if (!code) return null;
  return CODE_TO_KIND[code] ?? null;
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

/** Exposed for unit tests; not part of the public API. */
export const _internals = {
  CODE_TO_KIND,
  PATTERNS,
  HEADLINES,
  classifyCode,
  classifyMessage,
  extractCode,
  extractMessage,
};
