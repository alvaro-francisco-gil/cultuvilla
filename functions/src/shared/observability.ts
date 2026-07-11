import { createHmac } from 'node:crypto';
import { logger } from 'firebase-functions/v2';

const SHANNON_ENTROPY_BITS_PER_CHAR_MIN = 3.5;
const TOKEN_MIN_LENGTH = 20;

export const looksLikeToken = (s: string): boolean => {
  if (s.length < TOKEN_MIN_LENGTH) return false;
  if (!/[0-9]/.test(s)) return false;
  if (!/[a-zA-Z]/.test(s)) return false;
  const counts = new Map<string, number>();
  for (const c of s) counts.set(c, (counts.get(c) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy >= SHANNON_ENTROPY_BITS_PER_CHAR_MIN;
};

export const redactPII = (msg: string): string => {
  if (!msg) return msg;
  return msg
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/\+?\d{7,15}/g, '<phone>')
    .replace(/[A-Za-z0-9_-]{20,}/g, (s) => (looksLikeToken(s) ? '<token>' : s));
};

let cachedSalt: string | null = null;
let warnedAboutMissingSalt = false;

const getSalt = (override?: string): string => {
  if (override) return override;
  if (cachedSalt) return cachedSalt;
  const fromEnv = process.env.OBSERVABILITY_USER_ID_SALT;
  if (fromEnv) {
    cachedSalt = fromEnv;
    return fromEnv;
  }
  // Fails open: hashing continues with a placeholder (rather than dropping the
  // log) so a missing secret never blocks observability, but the visible
  // 'unsalted-' prefix plus this warn make the misconfiguration impossible to miss.
  if (!warnedAboutMissingSalt) {
    warnedAboutMissingSalt = true;
    if (process.env.FUNCTIONS_EMULATOR !== 'true' && process.env.NODE_ENV !== 'test') {
      logger.warn('OBSERVABILITY_USER_ID_SALT missing — hashing with placeholder', {
        handler: 'observability',
      });
    }
  }
  return 'unsalted-placeholder';
};

export const hashUserId = (uid: string, saltOverride?: string): string => {
  if (!uid) return uid;
  return createHmac('sha256', getSalt(saltOverride)).update(uid).digest('hex');
};

type Attrs = Record<string, unknown>;

export const transformAttrs = (attrs?: Attrs): Attrs | undefined => {
  if (!attrs) return attrs;
  const out: Attrs = { ...attrs };
  if (typeof out['user.id'] === 'string') out['user.id'] = hashUserId(out['user.id']);
  if (typeof out['error.message'] === 'string') out['error.message'] = redactPII(out['error.message']);
  if (typeof out['error.stack'] === 'string') out['error.stack'] = redactPII(out['error.stack']);
  return out;
};

// The single logging chokepoint. Domain code passes RAW values; hashing and
// scrubbing happen here — never at the call site. `attrs.handler` is required
// by convention so Cloud Logging can filter by Cloud Function name.
export const log = {
  info: (msg: string, attrs?: Attrs): void => {
    logger.info(msg, transformAttrs(attrs));
  },
  warn: (msg: string, attrs?: Attrs): void => {
    logger.warn(msg, transformAttrs(attrs));
  },
  error: (msg: string, attrs?: Attrs): void => {
    logger.error(msg, transformAttrs(attrs));
  },
};
