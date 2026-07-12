/* eslint-disable @typescript-eslint/no-explicit-any,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-call,
                  @typescript-eslint/no-unsafe-return,
                  @typescript-eslint/restrict-template-expressions,
                  @typescript-eslint/require-await */
// In-memory Firestore fake for getBarrioResidentCount. The count is a server-side
// aggregate over the same `municipalityLinks array-contains { municipalityId,
// barrioId }` query getPersonsByBarrio uses, so the fake implements array-contains
// (deep-equal on the link) + getCountFromServer.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

let store: Record<string, any> = {};

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
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
  function matches(q: any) {
    const prefix = `${q._col}/`;
    let docs = Object.entries(store)
      .filter(([id]) => id.startsWith(prefix))
      .map(([, data]) => data);
    for (const c of q._constraints) {
      if (c._type === 'where' && c.op === 'array-contains') {
        docs = docs.filter((d) => (d[c.field] ?? []).some((el: unknown) => deepEqual(el, c.value)));
      }
    }
    return docs;
  }
  return {
    collection,
    where,
    query,
    getCountFromServer: async (q: any) => ({ data: () => ({ count: matches(q).length }) }),
    getDocs: async () => ({ docs: [] }),
    doc: () => ({}),
    getDoc: async () => ({ exists: () => false }),
    orderBy: () => ({}),
    limit: () => ({}),
    addDoc: async () => ({ id: 'x' }),
    updateDoc: async () => undefined,
    deleteDoc: async () => undefined,
  };
});

import { getBarrioResidentCount } from '../../src/services/personService';

function person(links: Array<{ municipalityId: string; barrioId: string | null }>) {
  return { municipalityLinks: links };
}

beforeEach(() => {
  store = {};
});

describe('getBarrioResidentCount', () => {
  it('counts only people whose link matches the exact { municipalityId, barrioId }', async () => {
    store['persons/p1'] = person([{ municipalityId: 'm1', barrioId: 'centro' }]);
    store['persons/p2'] = person([{ municipalityId: 'm1', barrioId: 'centro' }]);
    store['persons/p3'] = person([{ municipalityId: 'm1', barrioId: 'norte' }]);

    expect(await getBarrioResidentCount('m1', 'centro')).toBe(2);
    expect(await getBarrioResidentCount('m1', 'norte')).toBe(1);
  });

  it('excludes whole-village members (barrioId null) and other villages', async () => {
    store['persons/p1'] = person([{ municipalityId: 'm1', barrioId: null }]);
    store['persons/p2'] = person([{ municipalityId: 'm2', barrioId: 'centro' }]);

    expect(await getBarrioResidentCount('m1', 'centro')).toBe(0);
  });

  it('returns 0 when no one lives in the barrio', async () => {
    expect(await getBarrioResidentCount('m1', 'centro')).toBe(0);
  });
});
