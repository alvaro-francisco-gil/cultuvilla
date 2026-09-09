// Firestore Rules e2e test for /vocabularyTerms and /vocabularyDefinitions.
//
// The pueblo's shared glossary: village members write, everyone reads. Two
// things here are load-bearing beyond the usual member/owner/admin axes and are
// what most of these cases pin down:
//
//   1. A term's doc id is DERIVED (`{municipalityId}__{slug}`), so the create
//      rule must tie the claimed municipalityId to the path — otherwise a
//      member of one pueblo could seed another pueblo's headword.
//   2. `definitionCount` is trigger-owned and gates the author's delete, so a
//      client must never be able to write it.
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, addDoc, collection } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const M = 'm1';
const TERM_ID = `${M}__esbardo`;

function termDoc(createdBy: string, extra: Record<string, unknown> = {}) {
  return {
    municipalityId: M,
    term: 'Esbardo',
    normalized: 'esbardo',
    kind: 'palabra',
    createdBy,
    createdAt: new Date(),
    definitionCount: 0,
    commentCount: 0,
    readCount: 0,
    status: 'active',
    hiddenBy: null,
    hiddenAt: null,
    hiddenReason: null,
    ...extra,
  };
}

function definitionDoc(createdBy: string, extra: Record<string, unknown> = {}) {
  return {
    municipalityId: M,
    termId: TERM_ID,
    definition: 'Cría de oso.',
    example: null,
    castellano: 'osezno',
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
    hiddenBy: null,
    hiddenAt: null,
    hiddenReason: null,
    ...extra,
  };
}

async function seedMember(uid: string, role: 'user' | 'admin' = 'user') {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role,
      joinedAt: new Date(),
      profileAnswers: {},
      profileCompletedAt: null,
    });
  });
}

async function seedTerm(createdBy: string, extra: Record<string, unknown> = {}) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `vocabularyTerms/${TERM_ID}`), termDoc(createdBy, extra));
  });
}

async function seedDefinition(id: string, createdBy: string, extra: Record<string, unknown> = {}) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), `vocabularyDefinitions/${id}`),
      definitionDoc(createdBy, extra),
    );
  });
}

describe('firestore.rules — /vocabularyTerms', () => {
  it('anyone, signed out included, can read an active term', async () => {
    await seedTerm('alice');
    await assertSucceeds(getDoc(doc(asAnon(getEnv()), `vocabularyTerms/${TERM_ID}`)));
  });

  it('a member creates a term at its derived id', async () => {
    await seedMember('alice');
    await assertSucceeds(
      setDoc(doc(asUser(getEnv(), 'alice'), `vocabularyTerms/${TERM_ID}`), termDoc('alice')),
    );
  });

  it('a non-member CANNOT create a term', async () => {
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'mallory'), `vocabularyTerms/${TERM_ID}`), termDoc('mallory')),
    );
  });

  it('CANNOT create a term whose doc id does not match its municipalityId + slug', async () => {
    await seedMember('alice');
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'alice'), 'vocabularyTerms/m2__esbardo'), termDoc('alice')),
    );
  });

  it('CANNOT create a term whose doc id does not match its normalized form', async () => {
    await seedMember('alice');
    await assertFails(
      setDoc(doc(asUser(getEnv(), 'alice'), `vocabularyTerms/${M}__otracosa`), termDoc('alice')),
    );
  });

  it('CANNOT create a term seeded with a non-zero definitionCount', async () => {
    await seedMember('alice');
    await assertFails(
      setDoc(
        doc(asUser(getEnv(), 'alice'), `vocabularyTerms/${TERM_ID}`),
        termDoc('alice', { definitionCount: 7 }),
      ),
    );
  });

  it('CANNOT create a term carrying an unknown field', async () => {
    await seedMember('alice');
    await assertFails(
      setDoc(
        doc(asUser(getEnv(), 'alice'), `vocabularyTerms/${TERM_ID}`),
        termDoc('alice', { upvotes: 3 }),
      ),
    );
  });

  it('CANNOT create a term with an unknown kind', async () => {
    await seedMember('alice');
    await assertFails(
      setDoc(
        doc(asUser(getEnv(), 'alice'), `vocabularyTerms/${TERM_ID}`),
        termDoc('alice', { kind: 'insulto' }),
      ),
    );
  });

  it('a term is not client-updatable, not even by its author', async () => {
    await seedMember('alice');
    await seedTerm('alice');
    await assertFails(
      updateDoc(doc(asUser(getEnv(), 'alice'), `vocabularyTerms/${TERM_ID}`), { term: 'Esbardu' }),
    );
  });

  it('the author deletes an empty term', async () => {
    await seedMember('alice');
    await seedTerm('alice');
    await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'alice'), `vocabularyTerms/${TERM_ID}`)));
  });

  it('the author CANNOT delete a term that still has definitions', async () => {
    await seedMember('alice');
    await seedTerm('alice', { definitionCount: 1 });
    await assertFails(deleteDoc(doc(asUser(getEnv(), 'alice'), `vocabularyTerms/${TERM_ID}`)));
  });

  it('a village admin deletes a term regardless of its definitions', async () => {
    await seedMember('root', 'admin');
    await seedTerm('alice', { definitionCount: 4 });
    await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'root'), `vocabularyTerms/${TERM_ID}`)));
  });
});

describe('firestore.rules — /vocabularyDefinitions', () => {
  it('a member adds a definition to an existing term', async () => {
    await seedMember('bob');
    await seedTerm('alice');
    await assertSucceeds(
      addDoc(collection(asUser(getEnv(), 'bob'), 'vocabularyDefinitions'), definitionDoc('bob')),
    );
  });

  it('CANNOT add a definition claiming a municipality the term does not belong to', async () => {
    await seedMember('bob');
    await seed(getEnv(), async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `vocabularyTerms/${TERM_ID}`),
        termDoc('alice', { municipalityId: 'm2' }),
      );
    });
    await assertFails(
      addDoc(collection(asUser(getEnv(), 'bob'), 'vocabularyDefinitions'), definitionDoc('bob')),
    );
  });

  it('CANNOT add a definition pointing at a term that does not exist', async () => {
    await seedMember('bob');
    await assertFails(
      addDoc(collection(asUser(getEnv(), 'bob'), 'vocabularyDefinitions'), definitionDoc('bob')),
    );
  });

  it('CANNOT add a definition attributed to somebody else', async () => {
    await seedMember('bob');
    await seedTerm('alice');
    await assertFails(
      addDoc(collection(asUser(getEnv(), 'bob'), 'vocabularyDefinitions'), definitionDoc('alice')),
    );
  });

  it('the author edits their own definition', async () => {
    await seedMember('bob');
    await seedTerm('alice');
    await seedDefinition('d1', 'bob');
    await assertSucceeds(
      updateDoc(doc(asUser(getEnv(), 'bob'), 'vocabularyDefinitions/d1'), {
        definition: 'Cría del oso pardo.',
        updatedAt: new Date(),
      }),
    );
  });

  it('a village admin CANNOT rewrite somebody else’s meaning — hide/delete is the lever', async () => {
    await seedMember('root', 'admin');
    await seedTerm('alice');
    await seedDefinition('d1', 'bob');
    await assertFails(
      updateDoc(doc(asUser(getEnv(), 'root'), 'vocabularyDefinitions/d1'), {
        definition: 'Otra cosa.',
        updatedAt: new Date(),
      }),
    );
  });

  it('the author CANNOT re-point their definition at another term', async () => {
    await seedMember('bob');
    await seedTerm('alice');
    await seedDefinition('d1', 'bob');
    await assertFails(
      updateDoc(doc(asUser(getEnv(), 'bob'), 'vocabularyDefinitions/d1'), {
        termId: `${M}__otracosa`,
      }),
    );
  });

  it('the author CANNOT unhide their own moderated definition', async () => {
    await seedMember('bob');
    await seedTerm('alice');
    await seedDefinition('d1', 'bob', { status: 'hidden', hiddenBy: 'root' });
    await assertFails(
      updateDoc(doc(asUser(getEnv(), 'bob'), 'vocabularyDefinitions/d1'), {
        status: 'active',
        hiddenBy: null,
      }),
    );
  });

  it('a village admin deletes somebody else’s definition', async () => {
    await seedMember('root', 'admin');
    await seedTerm('alice');
    await seedDefinition('d1', 'bob');
    await assertSucceeds(deleteDoc(doc(asUser(getEnv(), 'root'), 'vocabularyDefinitions/d1')));
  });

  it('an unrelated member CANNOT delete somebody else’s definition', async () => {
    await seedMember('carol');
    await seedTerm('alice');
    await seedDefinition('d1', 'bob');
    await assertFails(deleteDoc(doc(asUser(getEnv(), 'carol'), 'vocabularyDefinitions/d1')));
  });
});
