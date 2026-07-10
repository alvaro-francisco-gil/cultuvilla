import type { ObservabilityEventName } from './observabilityEvents';

export interface UserContext {
  uid: string;
  municipalityId?: string;
  villageId?: string;
  role?: string;
}
export interface ConsentState {
  analytics: boolean;
}
export interface OperationContext {
  flow: string;
  screen: string;
  operation_id: string;
  started_at_ms: number;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface ObservabilityAdapter {
  trackEvent(name: ObservabilityEventName, params: Record<string, unknown>, user: UserContext | null): void;
  captureError(error: unknown, context: Record<string, unknown>): void;
  log(level: LogLevel, msg: string, fields: Record<string, unknown>): void;
  setUserContext(user: UserContext | null): void;
  setConsent(consent: ConsentState): void;
}

// The single PII allowlist. Any key not here never leaves the port.
export const ALLOWED_CONTEXT_KEYS = [
  'uid',
  'municipalityId',
  'villageId',
  'role',
  'appVersion',
  'platform',
  'route',
  'operation_id',
] as const;

export function filterContext(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_CONTEXT_KEYS) {
    if (input[k] !== undefined) out[k] = input[k];
  }
  return out;
}

const noopAdapter: ObservabilityAdapter = {
  trackEvent: () => {},
  captureError: () => {},
  log: () => {},
  setUserContext: () => {},
  setConsent: () => {},
};

let adapter: ObservabilityAdapter = noopAdapter;
let currentUser: UserContext | null = null;
let currentConsent: ConsentState = { analytics: false };

export function configureObservability(next: ObservabilityAdapter): void {
  adapter = next;
  // Replay the state the app already established so a late-configured adapter
  // is not blind to the current user/consent.
  adapter.setConsent(currentConsent);
  adapter.setUserContext(currentUser);
}

let opCounter = 0;
const defaultOpPrefix =
  typeof globalThis.crypto.randomUUID === 'function' ? globalThis.crypto.randomUUID().slice(0, 8) : 'op';
const defaultIdFactory = (): string => `op-${defaultOpPrefix}-${String(opCounter++)}`;

export const observability = {
  setUserContext(user: UserContext | null): void {
    currentUser = user;
    adapter.setUserContext(user);
  },
  setConsent(consent: ConsentState): void {
    currentConsent = consent;
    adapter.setConsent(consent);
  },
  trackEvent(name: ObservabilityEventName, params: Record<string, unknown>): void {
    if (!currentConsent.analytics) return; // analytics is consent-gated
    adapter.trackEvent(name, filterContext(params), currentUser);
  },
  captureError(error: unknown, context: Record<string, unknown> = {}): void {
    adapter.captureError(error, filterContext(context)); // diagnosis flows pre-consent
  },
  logger: {
    info: (msg: string, fields: Record<string, unknown> = {}) => {
      adapter.log('info', msg, filterContext(fields));
    },
    warn: (msg: string, fields: Record<string, unknown> = {}) => {
      adapter.log('warn', msg, filterContext(fields));
    },
    error: (msg: string, fields: Record<string, unknown> = {}) => {
      adapter.log('error', msg, filterContext(fields));
    },
  },
  startOperation(flow: string, screen: string, idFactory: () => string = defaultIdFactory): OperationContext {
    return { flow, screen, operation_id: idFactory(), started_at_ms: 0 };
  },
};
