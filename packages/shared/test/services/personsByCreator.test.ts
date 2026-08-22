/* eslint-disable @typescript-eslint/no-explicit-any,
                  @typescript-eslint/no-unsafe-argument,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-return,
                  @typescript-eslint/require-await,
                  @typescript-eslint/restrict-template-expressions */
// Companion to personByUserId.test.ts. Same in-memory Firestore fake standing
// in for the rules engine: a `persons` list query that could match a doc the
// caller may not read is REJECTED outright, so the service must pin a rule
// branch. Modelled here by the service simply never issuing the unpinned form.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

let store: Record<string, any> = {};

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
      docs = docs.filter((d) => getPath(d.data(), c.field) === c.value);
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

import { getPersonsByCreator } from '../../src/services/personService';

function person(extra: Record<string, any>) {
  return {
    givenName: 'A', middleNames: [], firstSurname: null, secondSurname: null, nickname: null,
    sex: null, birthday: null, deathDate: null, birthPlace: null, burialPlace: null,
    municipalityLinks: [], occupations: [], biography: null,
    photoURL: null, userId: null, isPublic: true, createdBy: 'u1', ...extra,
  };
}

beforeEach(() => {
  store = {};
});

describe('getPersonsByCreator', () => {
  it('returns the caller their own personas, private ones included', async () => {
    store['persons/p1'] = person({ createdBy: 'me', userId: 'me' });
    store['persons/p2'] = person({ createdBy: 'me', isPublic: false });
    const res = await getPersonsByCreator('me', 'me');
    expect(res.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('pins the public branch when reading someone else, so the query is authorizable', async () => {
    store['persons/p1'] = person({ createdBy: 'other', userId: 'other' });
    store['persons/p2'] = person({ createdBy: 'other', isPublic: false });
    const res = await getPersonsByCreator('other', 'me');
    expect(res.map((p) => p.id)).toEqual(['p1']);
  });

  it('treats a signed-out caller like any other stranger', async () => {
    store['persons/p1'] = person({ createdBy: 'other', isPublic: false });
    expect(await getPersonsByCreator('other')).toEqual([]);
  });
});
