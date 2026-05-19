// Firestore Rules e2e test for /municipalities/{municipalityId}.
// Verifies: anyone can read; only app admins can create; once a community
// is active, its admin can update the community subfield.
//
// Uses @firebase/rules-unit-testing to mount the live firestore.rules file
// against the firestore emulator and execute requests under different auth
// contexts.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../firestore.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    firestore: { rules },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env.cleanup();
});

describe('firestore.rules — /municipalities/{municipalityId}', () => {
  it('anyone can read a municipality', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'municipalities/m1'), { name: 'Salamanca' });
    });

    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, 'municipalities/m1')));
  });

  it('non-admin cannot create a municipality', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'municipalities/m1'), { name: 'Nope' }));
  });

  it('app admin can create a municipality', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins/admin-1'), { createdAt: new Date() });
    });

    const admin = env.authenticatedContext('admin-1').firestore();
    await assertSucceeds(setDoc(doc(admin, 'municipalities/m1'), { name: 'Salamanca' }));
  });

  it('village admin can update the community subfield on their municipality', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'municipalities/m1'), {
        name: 'Salamanca',
        communityActive: true,
        community: { description: 'old' },
      });
      await setDoc(doc(ctx.firestore(), 'municipalities/m1/members/alice'), {
        role: 'admin',
      });
    });

    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(
      updateDoc(doc(alice, 'municipalities/m1'), { 'community.description': 'new' }),
    );
  });

  it('non-member cannot update a municipality', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'municipalities/m1'), { name: 'Salamanca' });
    });

    const bob = env.authenticatedContext('bob').firestore();
    await assertFails(updateDoc(doc(bob, 'municipalities/m1'), { name: 'Hacked' }));
  });
});
