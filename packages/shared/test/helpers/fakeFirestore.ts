/* eslint-disable @typescript-eslint/no-unnecessary-condition,
                  @typescript-eslint/no-dynamic-delete,
                  @typescript-eslint/require-await,
                  @typescript-eslint/restrict-template-expressions */
// In-memory Firestore fake shared by service tests that mock `firebase/firestore`
// via `vi.mock`. Only a couple of top-level collections are ever live at once in
// a given test file, so a single flat `store` keyed by `${collection}/${docId}`
// is enough to fake every query shape our services issue (where/orderBy/limit/
// startAfter/array-contains/!=).
//
// Usage in a test file:
//   import { createFakeFirestoreModule, resetFakeFirestore, fakeStore } from '../helpers/fakeFirestore';
//   vi.mock('../../src/firebase', () => ({ getDb: () => ({}) }));
//   vi.mock('firebase/firestore', () => createFakeFirestoreModule());
//   beforeEach(() => resetFakeFirestore());
//   // then read/seed docs directly via fakeStore()['col/id']

export type FakeDoc = Record<string, unknown>;

let store: Record<string, FakeDoc> = {};
let idCounter = 0;

/** Live handle onto the current in-memory store. Reassigned wholesale by
 * `resetFakeFirestore`, so callers must go through this accessor rather than
 * destructuring `store` once. */
export function fakeStore(): Record<string, FakeDoc> {
  return store;
}

export function resetFakeFirestore(): void {
  store = {};
  idCounter = 0;
}

function nextId() {
  return `auto${++idCounter}`;
}

function makeFakeDocRef(colId: string, docId: string) {
  const fullId = `${colId}/${docId}`;
  const ref: Record<string, unknown> = {
    id: docId,
    _col: colId,
    _id: fullId,
    get: (field: string) => (store[fullId] ?? {})[field],
  };
  ref['withConverter'] = () => ref;
  return ref;
}

function makeFakeCollRef(colId: string) {
  const ref: Record<string, unknown> = { _col: colId };
  ref['withConverter'] = () => ref;
  return ref as { _col: string; withConverter: () => unknown };
}

function makeDocSnap(colId: string, docId: string) {
  const fullId = `${colId}/${docId}`;
  const d = store[fullId];
  return {
    id: docId,
    exists: () => d !== undefined,
    data: () => d ?? {},
    get: (f: string) => (d ?? {})[f],
  };
}

/** Builds a fresh `firebase/firestore` mock module. Call this from inside a
 * `vi.mock('firebase/firestore', () => createFakeFirestoreModule())` factory —
 * it must stay a plain function (not itself a `vi.mock` call) so the hoisting
 * transform is free to hoist the outer `vi.mock` call above this import. */
export function createFakeFirestoreModule() {
  const serverTimestamp = () => ({ _isServerTimestamp: true, toDate: () => new Date(0) });
  const Timestamp = {
    fromDate: (d: Date) => ({ toDate: () => d, _isTimestamp: true }),
  };

  function collection(_db: unknown, colId: string) {
    return makeFakeCollRef(colId);
  }

  function doc(colOrRef: { _col: string }, ...rest: string[]) {
    // doc(collection(...)) — one arg, auto id
    if (rest.length === 0) {
      return makeFakeDocRef(colOrRef._col, nextId());
    }
    // doc(db, 'col', id) — three args (path style)
    if (rest.length === 2 && typeof rest[0] === 'string' && typeof rest[1] === 'string') {
      return makeFakeDocRef(rest[0], rest[1]);
    }
    // doc(collection(...), id) — two args
    const colId = colOrRef._col;
    const id = rest[0];
    return makeFakeDocRef(colId, id);
  }

  async function getDoc(ref: { _col: string; id: string }) {
    return makeDocSnap(ref._col, ref.id);
  }

  function resolveTimestamps(data: FakeDoc): FakeDoc {
    const resolved: FakeDoc = {};
    for (const [k, v] of Object.entries(data)) {
      if (
        v !== null &&
        typeof v === 'object' &&
        (v as Record<string, unknown>)['_isServerTimestamp']
      ) {
        resolved[k] = { toDate: () => new Date(0), _isTimestamp: true };
      } else {
        resolved[k] = v;
      }
    }
    return resolved;
  }

  async function setDoc(ref: { _id: string }, data: FakeDoc) {
    store[ref._id] = resolveTimestamps(data);
  }

  async function updateDoc(ref: { _id: string }, patch: FakeDoc) {
    const existing = store[ref._id] ?? {};
    store[ref._id] = { ...existing, ...resolveTimestamps(patch) };
  }

  async function deleteDoc(ref: { _id: string }) {
    delete store[ref._id];
  }

  function where(field: string, op: string, value: unknown) {
    return { _type: 'where', field, op, value };
  }

  function orderBy(field: string, dir = 'asc') {
    return { _type: 'orderBy', field, dir };
  }

  function limit(n: number) {
    return { _type: 'limit', n };
  }

  function startAfter(_cursor: unknown) {
    return { _type: 'startAfter', cursor: _cursor };
  }

  function query(colRef: { _col: string }, ...constraints: unknown[]) {
    return { _col: colRef._col, _constraints: constraints };
  }

  async function getDocs(q: { _col: string; _constraints: unknown[] }) {
    const colPrefix = `${q._col}/`;
    let docs = Object.entries(store)
      .filter(([id]) => id.startsWith(colPrefix))
      .map(([id, data]) => {
        const docId = id.slice(colPrefix.length);
        return { id: docId, data: () => data };
      });

    for (const c of q._constraints) {
      const constraint = c as Record<string, unknown>;
      if (constraint['_type'] === 'where') {
        const field = constraint['field'] as string;
        const op = constraint['op'] as string;
        const value = constraint['value'];
        docs = docs.filter((d) => {
          const docData = d.data();
          const fieldVal = docData[field];
          if (op === '==') return fieldVal === value;
          if (op === '!=') return fieldVal !== value;
          if (op === 'array-contains') return Array.isArray(fieldVal) && fieldVal.includes(value);
          return true;
        });
      }
      if (constraint['_type'] === 'limit') {
        const n = constraint['n'] as number;
        docs = docs.slice(0, n);
      }
    }

    return { docs };
  }

  async function getCountFromServer(q: { _col: string; _constraints: unknown[] }) {
    const { docs } = await getDocs(q);
    return { data: () => ({ count: docs.length }) };
  }

  return {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    getDocs,
    getCountFromServer,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    Timestamp,
  };
}
