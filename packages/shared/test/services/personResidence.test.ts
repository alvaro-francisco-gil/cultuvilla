/* eslint-disable @typescript-eslint/no-explicit-any,
                  @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-return,
                  @typescript-eslint/require-await,
                  @typescript-eslint/restrict-template-expressions */
// vi.mock-driven in-memory Firestore fake for updateResidenceBarrio — the
// account-holder change-barrio write path. Residence is single-source-of-truth
// on the person's municipalityLinks; this asserts the upsert keeps the exact
// { municipalityId, barrioId } shape getPersonsByBarrio matches on.
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));

let store: Record<string, any> = {};

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
      if (c._type === 'where' && c.op === '==') {
        docs = docs.filter((d) => d.data()[c.field] === c.value);
      }
    }
    return { docs };
  }
  return {
    collection,
    where,
    query,
    getDocs,
    doc: (_db: unknown, ...p: string[]) => ({ _id: p.join('/') }),
    getDoc: async () => ({ exists: () => false, data: () => undefined }),
    orderBy: () => ({}),
    limit: () => ({ _type: 'limit' }),
    addDoc: async () => ({ id: 'x' }),
    updateDoc: async (ref: any, data: any) => {
      store[ref._id] = { ...store[ref._id], ...data };
    },
    deleteDoc: async () => undefined,
  };
});

import { updateResidenceBarrio } from '../../src/services/personService';

function person(extra: Record<string, any>) {
  return { userId: null, municipalityLinks: [], createdBy: 'u1', ...extra };
}

beforeEach(() => {
  store = {};
});

describe('updateResidenceBarrio', () => {
  it('upserts the chosen barrio for the village, preserving other villages', async () => {
    store['persons/p1'] = person({
      userId: 'alice',
      municipalityLinks: [
        { municipalityId: 'm1', barrioId: null },
        { municipalityId: 'm2', barrioId: 'x' },
      ],
    });

    await updateResidenceBarrio('alice', 'm1', 'centro');

    expect(store['persons/p1'].municipalityLinks).toEqual([
      { municipalityId: 'm2', barrioId: 'x' },
      { municipalityId: 'm1', barrioId: 'centro' },
    ]);
  });

  it('adds a link when the village had none yet', async () => {
    store['persons/p1'] = person({ userId: 'alice', municipalityLinks: [] });

    await updateResidenceBarrio('alice', 'm1', 'centro');

    expect(store['persons/p1'].municipalityLinks).toEqual([
      { municipalityId: 'm1', barrioId: 'centro' },
    ]);
  });

  it('clears the barrio back to whole-village (null)', async () => {
    store['persons/p1'] = person({
      userId: 'alice',
      municipalityLinks: [{ municipalityId: 'm1', barrioId: 'centro' }],
    });

    await updateResidenceBarrio('alice', 'm1', null);

    expect(store['persons/p1'].municipalityLinks).toEqual([
      { municipalityId: 'm1', barrioId: null },
    ]);
  });

  it('is a no-op when the user has no linked person', async () => {
    await expect(updateResidenceBarrio('nobody', 'm1', 'centro')).resolves.toBeUndefined();
    expect(Object.keys(store)).toHaveLength(0);
  });
});
