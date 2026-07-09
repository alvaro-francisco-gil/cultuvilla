/* eslint-disable @typescript-eslint/no-unsafe-argument,
                  @typescript-eslint/no-unsafe-assignment */
// vi.mock factories legitimately fake the firebase/firestore SDK shape;
// the rule family doesn't add value for these inline mocks.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/firebase', () => ({ getDb: vi.fn() }));
vi.mock('../../src/firebase/refs/client', () => ({
  occupationsCollection: vi.fn(() => ({ _name: 'occupations' })),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _collectionName, slug) => ({ _slug: slug })),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  query: vi.fn((c) => c),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  increment: vi.fn((n) => ({ _increment: n })),
}));

import { doc, setDoc, increment } from 'firebase/firestore';
import { slugifyOccupation, recordOccupation } from '../../src/services/occupationService';

describe('slugifyOccupation', () => {
  it('lowercases, trims, and folds accents', () => {
    expect(slugifyOccupation('  Panadería ')).toBe('panaderia');
  });

  it('collapses internal whitespace to a single dash', () => {
    expect(slugifyOccupation('Herrero  del   Pueblo')).toBe('herrero-del-pueblo');
  });

  it('produces the same slug for differently-cased/accented variants', () => {
    const a = slugifyOccupation('Panadería');
    const b = slugifyOccupation('PANADERIA');
    const c = slugifyOccupation('  panadería  ');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe('recordOccupation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts occupations/{slug} with an incremented count', async () => {
    vi.mocked(setDoc).mockResolvedValue(undefined);

    await recordOccupation('Panadería');

    expect(doc).toHaveBeenCalledWith(undefined, 'occupations', 'panaderia');
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, payload, options] = vi.mocked(setDoc).mock.calls[0];
    expect(ref).toEqual({ _slug: 'panaderia' });
    expect(payload).toMatchObject({ name: 'Panadería', updatedAt: 'SERVER_TIMESTAMP' });
    expect(options).toEqual({ merge: true });
  });

  it('two differently-cased/accented names collide to the same doc id', async () => {
    vi.mocked(setDoc).mockResolvedValue(undefined);

    await recordOccupation('Panadería');
    await recordOccupation('PANADERIA');

    const firstRef = vi.mocked(setDoc).mock.calls[0][0];
    const secondRef = vi.mocked(setDoc).mock.calls[1][0];
    expect(firstRef).toEqual(secondRef);
  });

  it('increments count via FieldValue.increment(1)', async () => {
    vi.mocked(setDoc).mockResolvedValue(undefined);

    await recordOccupation('Agricultor');

    expect(increment).toHaveBeenCalledWith(1);
    const payload = vi.mocked(setDoc).mock.calls[0][1];
    expect(payload).toMatchObject({ count: { _increment: 1 } });
  });
});
