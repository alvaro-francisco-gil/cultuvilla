/* eslint-disable @typescript-eslint/no-explicit-any,
                  @typescript-eslint/no-unsafe-argument,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-return,
                  @typescript-eslint/require-await,
                  @typescript-eslint/restrict-template-expressions */
// In-memory Firestore fake (same shape as personPlaceQueries.test.ts). The fake
// stands in for the rules engine: `persons` reads are per-document, so a query
// that can match a private doc the caller may not read is REJECTED outright —
// modelled here by the service simply never issuing such a query.
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

import { getPersonByUserId } from '../../src/services/personService';

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

describe('getPersonByUserId', () => {
  it('returns another villager whose persona is public', async () => {
    store['persons/p1'] = person({ userId: 'other', createdBy: 'other' });
    const res = await getPersonByUserId('other', 'me');
    expect(res?.id).toBe('p1');
  });

  it('does not read a private persona belonging to someone else', async () => {
    store['persons/p1'] = person({ userId: 'other', createdBy: 'other', isPublic: false });
    // The unfiltered query would be denied by the rules for this doc — the
    // service must pin the public branch instead, so the caller gets null.
    expect(await getPersonByUserId('other', 'me')).toBeNull();
  });

  it('treats a signed-out caller like any other stranger', async () => {
    store['persons/p1'] = person({ userId: 'other', createdBy: 'other', isPublic: false });
    expect(await getPersonByUserId('other')).toBeNull();
  });

  it('still returns the caller their own private persona', async () => {
    store['persons/p1'] = person({ userId: 'me', createdBy: 'me', isPublic: false });
    const res = await getPersonByUserId('me', 'me');
    expect(res?.id).toBe('p1');
  });
});
