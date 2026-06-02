// Integration test: write a municipality to the Firestore emulator and read
// it back. Verifies the data layer (factory output, wire-format roundtrip),
// not the security rules — those are covered in test/e2e/villageRules.test.ts.
// Writes bypass rules via withSecurityRulesDisabled.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, addDoc, doc, getDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeMunicipality, makeActiveCommunity } from '../factories/villageFactory';

let env: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-test',
    firestore: { rules },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe('municipality roundtrip (emulator)', () => {
  it('persists a municipality and reads the same data back', async () => {
    const municipality = makeMunicipality({ name: 'Roundtrip Municipality' });
    let docId = '';
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      const ref = await addDoc(collection(db, 'municipalities'), municipality);
      docId = ref.id;

      const snap = await getDoc(doc(db, 'municipalities', docId));
      expect(snap.exists()).toBe(true);
      const data = snap.data();
      expect(data?.name).toBe('Roundtrip Municipality');
      expect(data?.province).toBe('Salamanca');
      expect(data?.communityActive).toBe(false);
      expect(data?.community).toBeNull();
    });
  });

  it('persists a municipality with an active community', async () => {
    const municipality = makeActiveCommunity({ name: 'Active Community' });
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      const ref = await addDoc(collection(db, 'municipalities'), municipality);

      const snap = await getDoc(doc(db, 'municipalities', ref.id));
      const data = snap.data() as
        | { communityActive?: boolean; community?: { adminUserId?: string } }
        | undefined;
      expect(data?.communityActive).toBe(true);
      expect(data?.community?.adminUserId).toBe('test-admin');
    });
  });
});
