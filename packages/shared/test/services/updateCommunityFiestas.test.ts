/* eslint-disable @typescript-eslint/no-explicit-any,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/require-await */
// `updateCommunity` writes through a bare `doc()` ref — no converter — while
// every read of a municipality parses strictly. Anything malformed that reaches
// the write makes the village document unreadable for EVERY user, not just the
// author, so the service is the last place that can refuse it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

let writes: any[] = [];

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ _id: path.join('/') }),
  updateDoc: async (_ref: any, data: any) => {
    writes.push(data);
  },
  collection: () => ({ withConverter: () => ({}) }),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  getDocs: async () => ({ docs: [] }),
  getDoc: async () => ({ exists: () => false }),
  setDoc: async () => undefined,
  deleteDoc: async () => undefined,
}));

import { updateCommunity } from '../../src/services/municipalityService';

const valid = {
  id: 'agosto',
  name: 'Fiestas de agosto',
  anchor: { month: 8, day: 23, days: 6 },
  years: {},
};

beforeEach(() => {
  writes = [];
});

describe('updateCommunity — fiestas validation', () => {
  it('writes a valid block', async () => {
    await updateCommunity('m1', { fiestas: [valid] });
    expect(writes).toHaveLength(1);
    expect(writes[0]['community.fiestas']).toEqual([valid]);
  });

  it('writes an empty list, which is how a village declares no fiestas', async () => {
    await updateCommunity('m1', { fiestas: [] });
    expect(writes[0]['community.fiestas']).toEqual([]);
  });

  // The reported failure: an admin backspacing the name field to empty would
  // persist name: '' and brick the village document for everyone.
  it('rejects an empty name instead of persisting it', async () => {
    await expect(updateCommunity('m1', { fiestas: [{ ...valid, name: '' }] })).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it('rejects an impossible anchor', async () => {
    await expect(
      updateCommunity('m1', { fiestas: [{ ...valid, anchor: { month: 13, day: 1, days: 1 } }] }),
    ).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it('rejects a window that ends before it starts', async () => {
    await expect(
      updateCommunity('m1', {
        fiestas: [{ ...valid, years: { 2026: { start: new Date('2026-08-28'), end: new Date('2026-08-23') } } }],
      }),
    ).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it('rejects duplicate block ids, which would collide in the Wrapped doc id', async () => {
    await expect(updateCommunity('m1', { fiestas: [valid, valid] })).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it('still writes the other community fields normally', async () => {
    await updateCommunity('m1', { description: 'hola' });
    expect(writes[0]['community.description']).toBe('hola');
  });
});
