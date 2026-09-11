import { describe, it, expect } from 'vitest';
import { buildFiestaBlock } from '@cultuvilla/shared/models';
import { blocksJustEnded, END_LOOKBACK_DAYS } from '../../wrapped/wrappedWindows';

const agosto = buildFiestaBlock({
  id: 'agosto',
  name: 'Fiestas de agosto',
  anchor: { month: 8, day: 14, days: 15 },
  years: { 2026: { start: new Date('2026-08-13T22:00:00Z'), end: new Date('2026-08-28T21:59:59.999Z') } },
});

// An anchor-only block: the pueblo declared roughly when its fiestas fall but
// never confirmed the year's dates.
const santiago = buildFiestaBlock({
  id: 'santiago',
  name: 'Santiago',
  anchor: { month: 7, day: 24, days: 3 },
});

describe('blocksJustEnded', () => {
  it('picks up a block whose exact window closed inside the lookback', () => {
    const found = blocksJustEnded([agosto], new Date('2026-08-29T03:00:00Z'));
    expect(found.map((f) => [f.block.id, f.year])).toEqual([['agosto', 2026]]);
  });

  it('ignores a block that has not ended yet', () => {
    expect(blocksJustEnded([agosto], new Date('2026-08-20T12:00:00Z'))).toEqual([]);
  });

  it('ignores a block that ended long ago, so last year never rebuilds', () => {
    const late = new Date(new Date('2026-08-28T21:59:59.999Z').getTime() + (END_LOOKBACK_DAYS + 1) * 86_400_000);
    expect(blocksJustEnded([agosto], late)).toEqual([]);
  });

  it('still covers a block missed while the scheduler was down', () => {
    const late = new Date(new Date('2026-08-28T21:59:59.999Z').getTime() + (END_LOOKBACK_DAYS - 1) * 86_400_000);
    expect(blocksJustEnded([agosto], late)).toHaveLength(1);
  });

  // The anchor is an approximation. A Wrapped built from it could silently clip
  // or over-include events, so a block without confirmed dates never runs.
  it('never fires for a block with no exact window for that year', () => {
    expect(blocksJustEnded([santiago], new Date('2026-07-28T12:00:00Z'))).toEqual([]);
  });

  it('still finds last year’s block in the first days of January', () => {
    const nochevieja = buildFiestaBlock({
      id: 'fin-de-ano',
      name: 'Fin de año',
      anchor: { month: 12, day: 30, days: 3 },
      years: { 2026: { start: new Date('2026-12-29T23:00:00Z'), end: new Date('2027-01-01T22:59:59.999Z') } },
    });
    const found = blocksJustEnded([nochevieja], new Date('2027-01-02T09:00:00Z'));
    expect(found.map((f) => f.year)).toEqual([2026]);
  });
});
