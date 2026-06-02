import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  computeStatuses,
  validateRegisterInput,
} from '../../helpers/registerToEventValidation';

describe('validateRegisterInput', () => {
  it('throws invalid-argument when data is missing', () => {
    expect(() => validateRegisterInput(undefined)).toThrow(HttpsError);
  });

  it('throws invalid-argument when eventId is missing', () => {
    expect(() =>
      validateRegisterInput({ registrants: [{ personId: 'p1', name: 'Ana' }] }),
    ).toThrow(/eventId/);
  });

  it('throws invalid-argument when registrants is empty', () => {
    expect(() => validateRegisterInput({ eventId: 'e1', registrants: [] })).toThrow(/asistente/);
  });

  it('throws invalid-argument when a registrant lacks personId', () => {
    expect(() =>
      validateRegisterInput({
        eventId: 'e1',
        // @ts-expect-error testing runtime guard
        registrants: [{ name: 'Ana' }],
      }),
    ).toThrow(/personId/);
  });

  it('throws invalid-argument when a registrant lacks name', () => {
    expect(() =>
      validateRegisterInput({
        eventId: 'e1',
        // @ts-expect-error testing runtime guard
        registrants: [{ personId: 'p1' }],
      }),
    ).toThrow(/name/);
  });

  it('rejects more than 50 registrants in one call', () => {
    const registrants = Array.from({ length: 51 }, (_, i) => ({
      personId: `p${String(i)}`,
      name: `N${String(i)}`,
    }));
    expect(() => validateRegisterInput({ eventId: 'e1', registrants })).toThrow(/50/);
  });

  it('trims registrant names', () => {
    const r = validateRegisterInput({
      eventId: 'e1',
      registrants: [{ personId: 'p1', name: '  Ana  ' }],
    });
    expect(r.registrants[0].name).toBe('Ana');
  });
});

describe('computeStatuses', () => {
  it('confirms all when maxAttendees is null', () => {
    const result = computeStatuses({
      maxAttendees: null,
      existingConfirmedCount: 100,
      existingTotalCount: 100,
      newCount: 3,
    });
    expect(result.map((s) => s.status)).toEqual(['confirmed', 'confirmed', 'confirmed']);
  });

  it('confirms up to capacity and waitlists the rest', () => {
    const result = computeStatuses({
      maxAttendees: 5,
      existingConfirmedCount: 3,
      existingTotalCount: 3,
      newCount: 4,
    });
    // 2 slots left → first 2 confirmed, next 2 waitlisted.
    expect(result.map((s) => s.status)).toEqual([
      'confirmed',
      'confirmed',
      'waitlisted',
      'waitlisted',
    ]);
  });

  it('positions are assigned consecutively after existingTotalCount', () => {
    const result = computeStatuses({
      maxAttendees: 10,
      existingConfirmedCount: 0,
      existingTotalCount: 7,
      newCount: 3,
    });
    expect(result.map((s) => s.position)).toEqual([8, 9, 10]);
  });

  it('waitlists everyone when the event is already full', () => {
    const result = computeStatuses({
      maxAttendees: 5,
      existingConfirmedCount: 5,
      existingTotalCount: 10,
      newCount: 2,
    });
    expect(result.map((s) => s.status)).toEqual(['waitlisted', 'waitlisted']);
  });
});
