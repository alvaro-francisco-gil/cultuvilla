/* eslint-disable @typescript-eslint/no-explicit-any,
                  @typescript-eslint/no-unsafe-argument,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-return,
                  @typescript-eslint/require-await,
                  @typescript-eslint/restrict-template-expressions */
// This file is a vi.mock-driven in-memory Firestore fake. Strict type-aware
// rules around mock SDK shapes and non-null assertions on test fixtures add
// noise without catching real bugs; the test logic is what matters.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

let store: Record<string, any> = {};

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function getPath(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

vi.mock('firebase/firestore', () => {
  function collection(_db: unknown, colId: string) {
    const ref: any = { _col: colId };
    ref.withConverter = () => ref;
    return ref;
  }
  function where(field: string, op: string, value: unknown) {
    return { _type: 'where', field, op, value };
  }
  function query(colRef: any, ...constraints: any[]) {
    return { _col: colRef._col, _constraints: constraints };
  }
  async function getDocs(q: any) {
    const prefix = `${q._col}/`;
    let docs = Object.entries(store)
      .filter(([id]) => id.startsWith(prefix))
      .map(([id, data]) => ({ id: id.slice(prefix.length), data: () => data }));
    for (const c of q._constraints) {
      if (c._type !== 'where') continue;
      docs = docs.filter((d) => {
        const fieldVal = getPath(d.data(), c.field);
        if (c.op === '==') return fieldVal === c.value;
        if (c.op === 'array-contains') {
          return Array.isArray(fieldVal) && fieldVal.some((el) => deepEqual(el, c.value));
        }
        return true;
      });
    }
    return { docs };
  }
  return {
    collection, where, query, getDocs,
    doc: (_db: unknown, ...p: string[]) => ({ _id: p.join('/'), id: p[p.length - 1], withConverter() { return this; } }),
    getDoc: async () => ({ exists: () => false, data: () => undefined }),
    orderBy: () => ({}), limit: () => ({}),
    addDoc: async () => ({ id: 'x' }), updateDoc: async () => undefined, deleteDoc: async () => undefined,
  };
});

import { getPersonsByBarrio, getPersonsByBurialPlace } from '../../src/services/personService';

function person(extra: Record<string, any>) {
  return {
    givenName: 'A', middleNames: [], firstSurname: null, secondSurname: null, nickname: null,
    sex: null, birthday: null, deathDate: null, birthPlace: null, burialPlace: null,
    municipalityLinks: [], occupationIds: [], pendingOccupations: [], biography: null,
    photoURL: null, userId: null, createdBy: 'u1', ...extra,
  };
}

beforeEach(() => {
  store = {};
});

describe('getPersonsByBarrio', () => {
  it('returns only people whose municipalityLinks include the exact {municipalityId, barrioId}', async () => {
    store['persons/p1'] = person({ givenName: 'Ana', municipalityLinks: [{ municipalityId: 'm1', barrioId: 'b1' }] });
    store['persons/p2'] = person({ givenName: 'Beto', municipalityLinks: [{ municipalityId: 'm1', barrioId: 'b2' }] });
    store['persons/p3'] = person({ givenName: 'Carla', municipalityLinks: [{ municipalityId: 'm1', barrioId: 'b1' }] });
    const res = await getPersonsByBarrio('m1', 'b1');
    expect(res.map((p) => p.id)).toEqual(['p1', 'p3']); // sorted by display name: Ana, Carla
  });

  it('returns an empty array when nobody is linked', async () => {
    expect(await getPersonsByBarrio('m1', 'bX')).toEqual([]);
  });
});

describe('getPersonsByBurialPlace', () => {
  it('returns people whose burialPlace.placeId matches, sorted by display name', async () => {
    store['persons/p1'] = person({ givenName: 'Zoe', burialPlace: { municipalityId: 'm1', placeId: 'c1' } });
    store['persons/p2'] = person({ givenName: 'Aldo', burialPlace: { municipalityId: 'm1', placeId: 'c1' } });
    store['persons/p3'] = person({ givenName: 'Bea', burialPlace: { municipalityId: 'm1', placeId: 'c2' } });
    const res = await getPersonsByBurialPlace('c1');
    expect(res.map((p) => p.id)).toEqual(['p2', 'p1']); // Aldo before Zoe
  });
});
