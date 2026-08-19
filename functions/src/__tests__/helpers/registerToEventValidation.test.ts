import { describe, expect, it } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import {
  computeGroupStatuses,
  computeStatuses,
  selectPromotionGroup,
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

  // Shape only — whether an answer matches its declared field type needs the
  // event, which this helper never loads (registerToEvent does that check).
  it('passes primitive answers through and omits an empty map', () => {
    const r = validateRegisterInput({
      eventId: 'e1',
      registrants: [
        { personId: 'p1', name: 'Ana', answers: { a: 'x', b: 2, c: true } },
        { personId: 'p2', name: 'Bea', answers: {} },
      ],
    });
    expect(r.registrants[0].answers).toEqual({ a: 'x', b: 2, c: true });
    expect(r.registrants[1].answers).toBeUndefined();
  });

  it('rejects a non-object answers payload', () => {
    expect(() =>
      validateRegisterInput({
        eventId: 'e1',
        registrants: [{ personId: 'p1', name: 'Ana', answers: ['x'] as unknown as Record<string, unknown> }],
      }),
    ).toThrow(/Respuestas inválidas/);
  });

  it('rejects a nested object as an answer value', () => {
    expect(() =>
      validateRegisterInput({
        eventId: 'e1',
        registrants: [{ personId: 'p1', name: 'Ana', answers: { a: { deep: 1 } } }],
      }),
    ).toThrow(/Respuestas inválidas/);
  });

  it('rejects more answers than an event could ever declare', () => {
    const answers = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`f${String(i)}`, 'x']));
    expect(() =>
      validateRegisterInput({
        eventId: 'e1',
        registrants: [{ personId: 'p1', name: 'Ana', answers }],
      }),
    ).toThrow(/Demasiadas respuestas/);
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

describe('validateRegisterInput — openSeats', () => {
  it('defaults openSeats to 0 when absent', () => {
    const out = validateRegisterInput({ eventId: 'e1', registrants: [{ personId: 'p1', name: 'Ana' }] });
    expect(out.openSeats).toBe(0);
  });

  it('passes a positive openSeats through', () => {
    const out = validateRegisterInput({
      eventId: 'e1',
      registrants: [{ personId: 'p1', name: 'Ana' }],
      openSeats: 1,
    });
    expect(out.openSeats).toBe(1);
  });

  it('rejects a negative or fractional openSeats', () => {
    for (const openSeats of [-1, 1.5]) {
      expect(() =>
        validateRegisterInput({
          eventId: 'e1',
          registrants: [{ personId: 'p1', name: 'Ana' }],
          openSeats,
        }),
      ).toThrow(/openSeats/);
    }
  });
});

describe('computeGroupStatuses', () => {
  it('confirms a whole group or waitlists it whole — never splits one', () => {
    // 9 of 10 seats taken and a pareja arriving: the seat that would fit must
    // NOT be taken, or the pareja is split, which is the outcome
    // signupGroupSize exists to prevent.
    const [pair] = computeGroupStatuses({
      maxAttendees: 10,
      existingConfirmedCount: 9,
      existingTotalCount: 9,
      groupSizes: [2],
    });
    expect(pair.map((s) => s.status)).toEqual(['waitlisted', 'waitlisted']);
  });

  it('confirms a group that fits exactly', () => {
    const [pair] = computeGroupStatuses({
      maxAttendees: 10,
      existingConfirmedCount: 8,
      existingTotalCount: 8,
      groupSizes: [2],
    });
    expect(pair.map((s) => s.status)).toEqual(['confirmed', 'confirmed']);
    expect(pair.map((s) => s.position)).toEqual([9, 10]);
  });

  it('confirms every group when the event is uncapped', () => {
    const groups = computeGroupStatuses({
      maxAttendees: null,
      existingConfirmedCount: 0,
      existingTotalCount: 0,
      groupSizes: [3, 3],
    });
    expect(groups.flat().every((s) => s.status === 'confirmed')).toBe(true);
    expect(groups.flat().map((s) => s.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps positions consecutive across a confirmed and a waitlisted group', () => {
    const groups = computeGroupStatuses({
      maxAttendees: 2,
      existingConfirmedCount: 0,
      existingTotalCount: 0,
      groupSizes: [2, 2],
    });
    expect(groups[0].map((s) => s.status)).toEqual(['confirmed', 'confirmed']);
    expect(groups[1].map((s) => s.status)).toEqual(['waitlisted', 'waitlisted']);
    expect(groups.flat().map((s) => s.position)).toEqual([1, 2, 3, 4]);
  });

  it('agrees with computeStatuses when every group is a single seat', () => {
    const opts = { maxAttendees: 3, existingConfirmedCount: 2, existingTotalCount: 2 };
    expect(computeGroupStatuses({ ...opts, groupSizes: [1, 1] }).flat()).toEqual(
      computeStatuses({ ...opts, newCount: 2 }),
    );
  });
});

describe('selectPromotionGroup', () => {
  const pair = (id: string, position: number, groupId: string | null) => ({ id, position, groupId });

  it('promotes nobody when no seat is free', () => {
    expect(selectPromotionGroup([pair('a', 1, null)], 0)).toEqual([]);
  });

  it('promotes the lowest-position ungrouped registration', () => {
    const chosen = selectPromotionGroup([pair('b', 2, null), pair('a', 1, null)], 1);
    expect(chosen.map((c) => c.id)).toEqual(['a']);
  });

  it('promotes a whole group, never half of one', () => {
    const chosen = selectPromotionGroup([pair('a', 1, 'g1'), pair('b', 2, 'g1')], 2);
    expect(chosen.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('promotes nobody when only half the group would fit', () => {
    expect(selectPromotionGroup([pair('a', 1, 'g1'), pair('b', 2, 'g1')], 1)).toEqual([]);
  });

  it('skips a group too large for the free space and takes the next that fits', () => {
    const chosen = selectPromotionGroup(
      [pair('a', 1, 'g1'), pair('b', 2, 'g1'), pair('c', 3, null)],
      1,
    );
    expect(chosen.map((c) => c.id)).toEqual(['c']);
  });

  it('keeps two ungrouped candidates distinct rather than merging them', () => {
    const chosen = selectPromotionGroup([pair('a', 1, null), pair('b', 2, null)], 2);
    expect(chosen.map((c) => c.id)).toEqual(['a']);
  });
});
