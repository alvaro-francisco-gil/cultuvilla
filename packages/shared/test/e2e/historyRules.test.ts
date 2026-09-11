// Firestore Rules e2e test for /historyEntries — a pueblo's history timeline.
//
// Members write, everyone reads, admins moderate. Beyond the usual axes, the
// cases pin down the two things the rules re-derive rather than trust:
//
//   1. `sortKey` must match `start`, so a client cannot file an entry at a
//      date it does not claim.
//   2. `municipalityId`, `createdBy` and the counters/visibility fields are
//      immutable to clients — authority is read from the stored doc.
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed, seedAdmin } from '../helpers/roles';
import {
  buildHistoryEntryData,
  buildHistoryEntryPatch,
  type HistoryEntryDataInput,
} from '../../src/models/history/HistoryEntryDataModel';

const getEnv = useRulesTestEnv();

const M = 'm1';
const ENTRY = 'e1';
const PATH = `historyEntries/${ENTRY}`;

function entry(createdBy: string, over: Partial<HistoryEntryDataInput> = {}) {
  return buildHistoryEntryData({
    municipalityId: M,
    villageSlug: 'villa',
    createdBy,
    title: 'Carta puebla',
    body: { text: 'El rey concede fueros.', mentions: [], links: [], marks: [] },
    start: { year: 1212, month: null, day: null },
    createdAt: new Date(),
    ...over,
  });
}

function patch(over: Partial<Parameters<typeof buildHistoryEntryPatch>[0]> = {}) {
  return buildHistoryEntryPatch({
    title: 'Carta puebla (corregida)',
    body: { text: 'Texto nuevo.', mentions: [], links: [], marks: [] },
    images: [],
    start: { year: 1213, month: 5, day: 2 },
    end: null,
    approximate: false,
    sources: 'Archivo municipal',
    updatedAt: new Date(),
    ...over,
  });
}

async function seedMember(uid: string, role: 'user' | 'admin' = 'user', municipalityId = M) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${municipalityId}/members/${uid}`), {
      role,
      joinedAt: new Date(),
      profileAnswers: {},
      profileCompletedAt: null,
    });
  });
}

async function seedEntry(createdBy: string, extra: Record<string, unknown> = {}) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), PATH), { ...entry(createdBy), ...extra });
  });
}

describe('firestore.rules — /historyEntries read', () => {
  it('anyone, signed out included, can read an active entry', async () => {
    await seedEntry('alice');
    await assertSucceeds(getDoc(doc(asAnon(getEnv()), PATH)));
  });

  it('a hidden entry is not public', async () => {
    await seedEntry('alice', { status: 'hidden', hiddenBy: 'admin', hiddenAt: new Date() });
    await assertFails(getDoc(doc(asAnon(getEnv()), PATH)));
    await seedMember('bob');
    await assertSucceeds(getDoc(doc(asUser(getEnv(), 'bob'), PATH)));
  });
});

describe('firestore.rules — /historyEntries create', () => {
  it('a member creates an entry', async () => {
    await seedMember('alice');
    await assertSucceeds(setDoc(doc(asUser(getEnv(), 'alice'), PATH), entry('alice')));
  });

  it('a member creates a BC range with a gallery', async () => {
    await seedMember('alice');
    await assertSucceeds(
      setDoc(
        doc(asUser(getEnv(), 'alice'), PATH),
        entry('alice', {
          start: { year: -218, month: null, day: null },
          end: { year: -19, month: null, day: null },
          approximate: true,
          images: [{ url: 'https://x/a.jpg', caption: 'Mosaico' }],
        }),
      ),
    );
  });

  it('a non-member CANNOT create an entry', async () => {
    await assertFails(setDoc(doc(asUser(getEnv(), 'mallory'), PATH), entry('mallory')));
  });

  it('CANNOT create an entry in someone else’s name', async () => {
    await seedMember('alice');
    await assertFails(setDoc(doc(asUser(getEnv(), 'alice'), PATH), entry('bob')));
  });

  it('CANNOT file an entry under a sortKey that disagrees with its start', async () => {
    await seedMember('alice');
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'alice'), PATH), { ...entry('alice'), sortKey: 99990000 }),
    );
  });

  it('CANNOT create a range that ends before it starts', async () => {
    await seedMember('alice');
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'alice'), PATH), {
        ...entry('alice', { start: { year: 1939, month: null, day: null } }),
        end: { year: 1936, month: null, day: null },
      }),
    );
  });

  it('CANNOT exceed three images', async () => {
    await seedMember('alice');
    const img = { url: 'https://x/a.jpg', caption: null };
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'alice'), PATH), { ...entry('alice'), images: [img, img, img, img] }),
    );
  });

  it('CANNOT create with pre-seeded counters or a hidden status', async () => {
    await seedMember('alice');
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'alice'), PATH), { ...entry('alice'), commentCount: 5 }),
    );
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'alice'), PATH), { ...entry('alice'), status: 'hidden' }),
    );
  });

  it('CANNOT use year 0 or a day without a month', async () => {
    await seedMember('alice');
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'alice'), PATH), {
        ...entry('alice'),
        start: { year: 0, month: null, day: null },
        sortKey: 0,
      }),
    );
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'alice'), PATH), {
        ...entry('alice'),
        start: { year: 1900, month: null, day: 3 },
        sortKey: 19000003,
      }),
    );
  });
});

describe('firestore.rules — /historyEntries update', () => {
  it('the author edits their entry, re-dating it', async () => {
    await seedEntry('alice');
    await assertSucceeds(updateDoc(doc(asUser(getEnv(), 'alice'), PATH), patch()));
  });

  it('a village admin corrects someone else’s entry', async () => {
    await seedEntry('alice');
    await seedMember('ana', 'admin');
    await assertSucceeds(updateDoc(doc(asUser(getEnv(), 'ana'), PATH), patch()));
  });

  it('an app admin corrects an entry', async () => {
    await seedEntry('alice');
    await seedAdmin(getEnv(), 'root');
    await assertSucceeds(updateDoc(doc(asUser(getEnv(), 'root'), PATH), patch()));
  });

  it('another plain member CANNOT edit it', async () => {
    await seedEntry('alice');
    await seedMember('bob');
    await assertFails(updateDoc(doc(asUser(getEnv(), 'bob'), PATH), patch()));
  });

  it('an admin of ANOTHER pueblo cannot edit it', async () => {
    await seedEntry('alice');
    await seedMember('ana', 'admin', 'm2');
    await assertFails(updateDoc(doc(asUser(getEnv(), 'ana'), PATH), patch()));
  });

  it('CANNOT move the entry to another pueblo', async () => {
    await seedEntry('alice');
    await assertFails(updateDoc(doc(asUser(getEnv(), 'alice'), PATH), { municipalityId: 'm2' }));
  });

  it('CANNOT rewrite its pueblo slug — shared links would break', async () => {
    await seedEntry('alice');
    await assertFails(updateDoc(doc(asUser(getEnv(), 'alice'), PATH), { villageSlug: 'otro-pueblo' }));
  });

  it('CANNOT touch the counters or visibility', async () => {
    await seedEntry('alice');
    await assertFails(updateDoc(doc(asUser(getEnv(), 'alice'), PATH), { readCount: 100 }));
    await assertFails(updateDoc(doc(asUser(getEnv(), 'alice'), PATH), { status: 'hidden' }));
  });

  it('CANNOT change the start without re-deriving sortKey', async () => {
    await seedEntry('alice');
    await assertFails(
      updateDoc(doc(asUser(getEnv(), 'alice'), PATH), { start: { year: 1500, month: null, day: null } }),
    );
  });
});

describe('firestore.rules — /historyEntries delete', () => {
  it('the author withdraws their active entry', async () => {
    await seedEntry('alice');
    await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'alice'), PATH)));
  });

  it('the author CANNOT delete an entry moderation has hidden', async () => {
    await seedEntry('alice', { status: 'hidden', hiddenBy: 'ana', hiddenAt: new Date() });
    await assertFails(deleteDoc(doc(asUser(getEnv(), 'alice'), PATH)));
  });

  it('a village admin deletes any entry', async () => {
    await seedEntry('alice');
    await seedMember('ana', 'admin');
    await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'ana'), PATH)));
  });

  it('another member CANNOT delete it', async () => {
    await seedEntry('alice');
    await seedMember('bob');
    await assertFails(deleteDoc(doc(asUser(getEnv(), 'bob'), PATH)));
  });
});
