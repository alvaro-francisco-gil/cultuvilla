/* eslint-disable @typescript-eslint/no-explicit-any,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-return,
                  @typescript-eslint/require-await */
// This file is a vi.mock-driven in-memory Firestore fake. Strict type-aware
// rules around mock SDK shapes and non-null assertions on test fixtures add
// noise without catching real bugs; the test logic is what matters.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

let store: Record<string, any> = {};

vi.mock('firebase/firestore', () => {
  function doc(_db: unknown, ...path: string[]) {
    const _id = path.join('/');
    const ref: any = { _id, id: path[path.length - 1] };
    ref.withConverter = () => ref;
    return ref;
  }
  async function getDoc(ref: any) {
    const d = store[ref._id];
    return { id: ref.id, exists: () => d !== undefined, data: () => d };
  }
  return {
    doc,
    getDoc,
    // refs/client also imports these at module load; stub them as no-ops.
    collection: () => ({ withConverter: () => ({}) }),
    query: () => ({}),
    where: () => ({}),
    orderBy: () => ({}),
    getDocs: async () => ({ docs: [] }),
    setDoc: async () => undefined,
    updateDoc: async () => undefined,
    deleteDoc: async () => undefined,
  };
});

import { getBarrio, getPlace } from '../../src/services/municipalityService';

beforeEach(() => {
  store = {};
});

describe('getBarrio', () => {
  it('returns the barrio with its id when it exists', async () => {
    store['municipalities/m1/barrios/b1'] = { name: 'Centro', municipalityId: 'm1', imageURL: null };
    const b = await getBarrio('m1', 'b1');
    expect(b).toEqual({ id: 'b1', name: 'Centro', municipalityId: 'm1', imageURL: null });
  });

  it('returns null when the barrio is missing', async () => {
    expect(await getBarrio('m1', 'nope')).toBeNull();
  });
});

describe('getPlace', () => {
  it('returns the place with its id when it exists', async () => {
    store['municipalities/m1/places/p1'] = {
      name: 'San Roque', kind: 'cemetery', description: null, municipalityId: 'm1', imageURL: null,
    };
    const p = await getPlace('m1', 'p1');
    expect(p).toMatchObject({ id: 'p1', name: 'San Roque', kind: 'cemetery' });
  });

  it('returns null when the place is missing', async () => {
    expect(await getPlace('m1', 'nope')).toBeNull();
  });
});
