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

const valid = { id: 'carmen', name: 'Carmen', month: 8 };

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

  it('rejects a month that does not exist', async () => {
    await expect(updateCommunity('m1', { fiestas: [{ ...valid, month: 13 }] })).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it('rejects the old dated shape, so a stale client cannot write days back', async () => {
    const dated = { id: 'carmen', name: 'Carmen', anchor: { month: 8, day: 14, days: 3 }, years: {} };
    await expect(updateCommunity('m1', { fiestas: [dated as never] })).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it('rejects duplicate block ids, which the Wrapped request refers to', async () => {
    await expect(updateCommunity('m1', { fiestas: [valid, valid] })).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });

  it('still writes the other community fields normally', async () => {
    await updateCommunity('m1', { description: 'hola' });
    expect(writes[0]['community.description']).toBe('hola');
  });
});
