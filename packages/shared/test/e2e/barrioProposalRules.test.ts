import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();
const M = 'm1';
function barrioDoc(proposedBy: string | null, extra: Record<string, unknown> = {}) {
  return {
    name: 'Norte', municipalityId: M, imageURL: null, createdAt: new Date(),
    status: 'active', proposedBy, hiddenBy: null, hiddenAt: null, hiddenReason: null,
    commentCount: 0, reactionCounts: { like: 0, heart: 0 },
    ...extra,
  };
}
async function seedMember(uid: string, role: 'user' | 'admin' = 'user') {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/members/${uid}`), {
      role, joinedAt: new Date(), profileAnswers: {}, profileCompletedAt: null,
    });
  });
}
async function seedBarrio(id: string, proposedBy: string | null, extra: Record<string, unknown> = {}) {
  await seed(getEnv(), async (ctx) => {
    await setDoc(doc(ctx.firestore(), `municipalities/${M}/barrios/${id}`), barrioDoc(proposedBy, extra));
  });
}

describe('firestore.rules — /municipalities/{m}/barrios', () => {
  it('anyone can read barrios', async () => {
    await seedBarrio('b1', null);
    await assertSucceeds(getDoc(doc(asAnon(getEnv()), `municipalities/${M}/barrios/b1`)));
  });
  it('member can create an active barrio (instant self-service)', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(setDoc(doc(alice, `municipalities/${M}/barrios/b1`), barrioDoc('alice')));
  });
  it('member CANNOT create a barrio already hidden', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, `municipalities/${M}/barrios/b1`), barrioDoc('alice', { status: 'hidden' })),
    );
  });
  it('member CANNOT create a barrio with non-null hiddenBy', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, `municipalities/${M}/barrios/b1`), barrioDoc('alice', { hiddenBy: 'alice' })),
    );
  });
  it('non-member cannot create a barrio', async () => {
    const stranger = asUser(getEnv(), 'stranger');
    await assertFails(setDoc(doc(stranger, `municipalities/${M}/barrios/b1`), barrioDoc('stranger')));
  });
  it('village admin can create a barrio directly', async () => {
    await seedMember('boss', 'admin');
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(setDoc(doc(boss, `municipalities/${M}/barrios/b1`), barrioDoc(null)));
  });
  it('proposer can edit own barrio content fields', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(updateDoc(doc(alice, `municipalities/${M}/barrios/b1`), { name: 'Norte Alto' }));
  });
  it('proposer CANNOT change status on their own barrio', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(updateDoc(doc(alice, `municipalities/${M}/barrios/b1`), { status: 'hidden' }));
  });
  it('proposer CANNOT set hiddenBy/hiddenAt/hiddenReason directly', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      updateDoc(doc(alice, `municipalities/${M}/barrios/b1`), {
        hiddenBy: 'alice', hiddenAt: new Date(), hiddenReason: 'self-hide',
      }),
    );
  });
  it('village admin CANNOT change status via a plain client update either', async () => {
    await seedMember('boss', 'admin');
    await seedBarrio('b1', 'alice');
    const boss = asUser(getEnv(), 'boss');
    await assertFails(updateDoc(doc(boss, `municipalities/${M}/barrios/b1`), { status: 'hidden' }));
  });
  it('proposer can withdraw (delete) own barrio', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'alice');
    const alice = asUser(getEnv(), 'alice');
    await assertSucceeds(deleteDoc(doc(alice, `municipalities/${M}/barrios/b1`)));
  });
  it('proposer CANNOT delete their own barrio once hidden (moderation bypass)', async () => {
    await seedMember('alice');
    await seedBarrio('b1', 'alice', { status: 'hidden', hiddenBy: 'boss', hiddenAt: new Date(), hiddenReason: 'spam' });
    const alice = asUser(getEnv(), 'alice');
    await assertFails(deleteDoc(doc(alice, `municipalities/${M}/barrios/b1`)));
  });
  it('village admin can delete a hidden barrio', async () => {
    await seedMember('boss', 'admin');
    await seedBarrio('b1', 'alice', { status: 'hidden', hiddenBy: 'boss', hiddenAt: new Date(), hiddenReason: 'spam' });
    const boss = asUser(getEnv(), 'boss');
    await assertSucceeds(deleteDoc(doc(boss, `municipalities/${M}/barrios/b1`)));
  });

  // D5 count guards: counts are function-owned (synced by the comments/
  // reactions triggers), so clients must create at 0 and never touch them
  // again, even through an otherwise-authorized update.
  it('rejects a create with a nonzero commentCount', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, `municipalities/${M}/barrios/b1`), {
        ...barrioDoc('alice'), commentCount: 5,
      }),
    );
  });

  it('rejects a create with a nonzero reactionCounts', async () => {
    await seedMember('alice');
    const alice = asUser(getEnv(), 'alice');
    await assertFails(
      setDoc(doc(alice, `municipalities/${M}/barrios/b1`), {
        ...barrioDoc('alice'), reactionCounts: { like: 3, heart: 0 },
      }),
    );
  });

  it('village admin cannot mutate counts on update, but a normal edit still succeeds', async () => {
    await seedMember('boss', 'admin');
    await seedBarrio('b1', 'alice');
    const boss = asUser(getEnv(), 'boss');
    await assertFails(updateDoc(doc(boss, `municipalities/${M}/barrios/b1`), { commentCount: 99 }));
    await assertFails(
      updateDoc(doc(boss, `municipalities/${M}/barrios/b1`), { reactionCounts: { like: 9, heart: 9 } }),
    );
    await assertSucceeds(
      updateDoc(doc(boss, `municipalities/${M}/barrios/b1`), { name: 'Norte Alto' }),
    );
  });
});
