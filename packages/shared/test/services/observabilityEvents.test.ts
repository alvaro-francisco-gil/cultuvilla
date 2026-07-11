import { describe, it, expect } from 'vitest';
import { OBSERVABILITY_EVENTS } from '../../src/services/observability/observabilityEvents';

describe('OBSERVABILITY_EVENTS', () => {
  it('names follow <domain>.<action>.<outcome> and are unique', () => {
    const names = Object.values(OBSERVABILITY_EVENTS);
    for (const n of names) expect(n).toMatch(/^[a-z]+(\.[a-z_]+){2}$/);
    expect(new Set(names).size).toBe(names.length);
  });
  it('covers the four starter funnels', () => {
    expect(OBSERVABILITY_EVENTS.ONBOARDING_STARTED).toBeDefined();
    expect(OBSERVABILITY_EVENTS.VILLAGE_JOIN_SUCCESS).toBeDefined();
    expect(OBSERVABILITY_EVENTS.EVENT_SIGNUP_SUCCESS).toBeDefined();
    expect(OBSERVABILITY_EVENTS.ORG_CREATE_SUCCESS).toBeDefined();
  });
});
