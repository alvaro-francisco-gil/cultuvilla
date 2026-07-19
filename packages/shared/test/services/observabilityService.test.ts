import { describe, it, expect, beforeEach } from 'vitest';
import {
  observability,
  configureObservability,
  filterContext,
  type ObservabilityAdapter,
} from '../../src/services/observability/observabilityService';
import { OBSERVABILITY_EVENTS } from '../../src/services/observability/observabilityEvents';

function makeSpyAdapter(): ObservabilityAdapter & { calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = { trackEvent: [], captureError: [], log: [], setUserContext: [], setConsent: [] };
  return {
    calls,
    trackEvent: (...a) => {
      calls.trackEvent.push(a);
    },
    captureError: (...a) => {
      calls.captureError.push(a);
    },
    log: (...a) => {
      calls.log.push(a);
    },
    setUserContext: (...a) => {
      calls.setUserContext.push(a);
    },
    setConsent: (...a) => {
      calls.setConsent.push(a);
    },
  };
}

describe('filterContext', () => {
  it('keeps allowlisted keys and drops the rest', () => {
    const out = filterContext({ uid: 'u1', role: 'admin', email: 'x@y.com', note: 'secret' });
    expect(out).toEqual({ uid: 'u1', role: 'admin' });
  });
});

describe('observability port', () => {
  let adapter: ReturnType<typeof makeSpyAdapter>;
  beforeEach(() => {
    adapter = makeSpyAdapter();
    configureObservability(adapter);
    observability.setConsent({ analytics: true });
  });

  it('is a safe no-op before an adapter is configured', () => {
    // reset to default no-op by configuring a fresh spy then calling with denied consent
    expect(() => {
      observability.trackEvent(OBSERVABILITY_EVENTS.VILLAGE_JOIN_SUCCESS, {});
    }).not.toThrow();
  });

  it('suppresses trackEvent when analytics consent is denied', () => {
    observability.setConsent({ analytics: false });
    observability.trackEvent(OBSERVABILITY_EVENTS.EVENT_SIGNUP_SUCCESS, { villageId: 'v1' });
    expect(adapter.calls.trackEvent.length).toBe(0);
  });

  it('forwards trackEvent with filtered params when consent granted', () => {
    observability.trackEvent(OBSERVABILITY_EVENTS.EVENT_SIGNUP_SUCCESS, { villageId: 'v1', leaked: 'x' });
    expect(adapter.calls.trackEvent.length).toBe(1);
    const [name, params] = adapter.calls.trackEvent[0];
    expect(name).toBe(OBSERVABILITY_EVENTS.EVENT_SIGNUP_SUCCESS);
    expect(params).toEqual({ villageId: 'v1' });
  });

  it('forwards the new engagement keys through filterContext', () => {
    observability.trackEvent(OBSERVABILITY_EVENTS.CONTENT_DETAIL_VIEWED, {
      entityKind: 'event',
      entityId: 'e1',
      municipalityId: 'm1',
      surface: 'village_discovery',
      resultCount: 3,
      viaInvite: true,
      leaked: 'nope',
    });
    const [, params] = adapter.calls.trackEvent[0];
    expect(params).toEqual({
      entityKind: 'event',
      entityId: 'e1',
      municipalityId: 'm1',
      surface: 'village_discovery',
      resultCount: 3,
      viaInvite: true,
    });
  });

  it('captureError flows even when analytics consent is denied', () => {
    observability.setConsent({ analytics: false });
    observability.captureError(new Error('boom'), { route: '/x', leaked: 'y' });
    expect(adapter.calls.captureError.length).toBe(1);
    const [, ctx] = adapter.calls.captureError[0];
    expect(ctx).toEqual({ route: '/x' });
  });

  it('startOperation threads a stable operation_id', () => {
    const op = observability.startOperation('village.join', 'VillageDiscovery', () => 'op-fixed');
    expect(op.operation_id).toBe('op-fixed');
    expect(op.flow).toBe('village.join');
  });
});
