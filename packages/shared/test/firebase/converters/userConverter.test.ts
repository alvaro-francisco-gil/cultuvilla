import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { userConverterClient } from '../../../src/firebase/converters/userConverter.client';

/**
 * Regression: onboarding writes the user doc via createUserProfile, which
 * intentionally omits `displayName` (it's a denormalized projection written
 * only by the syncPersonDenormalization Cloud Function trigger). That trigger
 * is async, so the very next read — refreshProfile() -> getUserProfile() ->
 * userConverterClient.fromFirestore — observes a user doc with NO displayName
 * field. The converter must degrade it to '' (per UserDataSchema's documented
 * contract), not throw. Before the fix this threw:
 *   [{ path: ['displayName'], code: 'invalid_type', expected: 'string',
 *      received: 'undefined' }]
 */
describe('userConverterClient — pre-trigger onboarding read', () => {
  // The exact payload createUserProfile merges into users/{uid}: account state
  // only, no displayName. serverTimestamp() lands as a Timestamp on read-back.
  const createUserProfilePayload = {
    email: 'nuevo@example.com',
    telephone: null,
    activeMunicipalityId: 'mun-1',
    personId: 'person-1',
    createdAt: Timestamp.fromDate(new Date('2026-07-03T00:00:00Z')),
  };

  it('fromFirestore degrades a missing displayName to "" instead of throwing', () => {
    const snap = { data: () => createUserProfilePayload };
    const user = userConverterClient.fromFirestore(snap);
    expect(user.displayName).toBe('');
    expect(user.email).toBe('nuevo@example.com');
    expect(user.personId).toBe('person-1');
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it('fromFirestore preserves a real displayName once the trigger has written it', () => {
    const snap = {
      data: () => ({ ...createUserProfilePayload, displayName: 'Juan García' }),
    };
    const user = userConverterClient.fromFirestore(snap);
    expect(user.displayName).toBe('Juan García');
  });
});
