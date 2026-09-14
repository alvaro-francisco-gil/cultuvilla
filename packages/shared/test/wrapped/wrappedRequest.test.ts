import { describe, it, expect } from 'vitest';
import { coveringRange, resolveWrappedRequest, type WrappedRequest } from '../../src/wrapped/wrappedRequest';

const FIESTAS = [
  { id: 'santiago', name: 'Santiago', month: 7 },
  { id: 'carmen', name: 'Carmen', month: 8 },
];
const TODAY = '2026-09-14';

function request(overrides: Partial<WrappedRequest> = {}): WrappedRequest {
  return {
    municipalityId: 'm1',
    year: 2026,
    blocks: [
      { blockId: 'carmen', startDay: '2026-08-14', endDay: '2026-08-28' },
      { blockId: 'santiago', startDay: '2026-07-24', endDay: '2026-07-26' },
    ],
    range: { startDay: '2026-07-15', endDay: '2026-08-31' },
    ...overrides,
  };
}

function problemOf(r: ReturnType<typeof resolveWrappedRequest>): string | null {
  return r.ok ? null : r.problem;
}

describe('resolveWrappedRequest', () => {
  it('resolves Matabuena 2026 into dated blocks, in date order, with names from the profile', () => {
    const r = resolveWrappedRequest(request(), FIESTAS, TODAY);
    if (!r.ok) throw new Error(r.problem);
    expect(r.blocks.map((b) => [b.blockId, b.name])).toEqual([
      ['santiago', 'Santiago'],
      ['carmen', 'Carmen'],
    ]);
    expect(r.blocks[1].start.toISOString()).toBe('2026-08-13T22:00:00.000Z');
    expect(r.range.end.toISOString()).toBe('2026-08-31T21:59:59.999Z');
  });

  it('accepts a single block with a range equal to it', () => {
    const one = { blockId: 'carmen', startDay: '2026-08-14', endDay: '2026-08-28' };
    expect(problemOf(resolveWrappedRequest(request({ blocks: [one], range: one }), FIESTAS, TODAY))).toBeNull();
  });

  it('accepts a range ending today', () => {
    expect(problemOf(resolveWrappedRequest(request({ range: { startDay: '2026-07-01', endDay: TODAY } }), FIESTAS, TODAY))).toBeNull();
  });

  it.each([
    ['malformed', { year: '2026' }],
    ['malformed', { blocks: [] }],
    ['malformed', { range: { startDay: '2026-02-30', endDay: '2026-08-31' } }],
    ['unknown-block', { blocks: [{ blockId: 'san-roque', startDay: '2026-08-16', endDay: '2026-08-16' }] }],
    [
      'duplicate-block',
      {
        blocks: [
          { blockId: 'carmen', startDay: '2026-08-14', endDay: '2026-08-15' },
          { blockId: 'carmen', startDay: '2026-08-20', endDay: '2026-08-21' },
        ],
      },
    ],
    ['outside-year', { range: { startDay: '2025-12-20', endDay: '2026-08-31' } }],
    ['ends-before-start', { blocks: [{ blockId: 'carmen', startDay: '2026-08-28', endDay: '2026-08-14' }] }],
    ['range-in-future', { range: { startDay: '2026-07-15', endDay: '2026-09-15' } }],
    ['range-misses-block', { range: { startDay: '2026-07-25', endDay: '2026-08-31' } }],
  ])('refuses %s', (problem, overrides) => {
    expect(problemOf(resolveWrappedRequest({ ...request(), ...overrides }, FIESTAS, TODAY))).toBe(problem);
  });

  it('refuses a block the village no longer declares', () => {
    expect(problemOf(resolveWrappedRequest(request(), [FIESTAS[0]], TODAY))).toBe('unknown-block');
  });
});

describe('coveringRange', () => {
  it('is the hull of the spans', () => {
    expect(coveringRange(request().blocks)).toEqual({ startDay: '2026-07-24', endDay: '2026-08-28' });
  });

  it('is null with nothing to cover', () => {
    expect(coveringRange([])).toBeNull();
  });
});
