// Integration test for villageMemberService.getUserMemberships.
//
// Seeds municipality/{m}/members/{uid} docs via withSecurityRulesDisabled
// (we're testing the service's query shape, not the rules — rules are
// covered by test/e2e/villageMemberRules.test.ts), then calls the service
// and verifies it returns the right rows across municipalities.
//
// Why this layer exists: catches "wrong collection name" / "wrong where
// clause" bugs in the service that a mocked-Firestore unit test cannot.
//
// The service calls getDb() from the shared firebase singleton.  For these
// tests we spy on getDb() to return an authenticated-context Firestore from
// @firebase/rules-unit-testing so the collectionGroup rule (requires auth)
// is satisfied without initialising the full Firebase JS SDK.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getUserMemberships } from '../../src/services/villageMemberService';
import * as firebaseModule from '../../src/firebase';

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
  vi.restoreAllMocks();
  await env.cleanup();
});

describe('villageMemberService — getUserMemberships', () => {
  it('returns memberships for the caller across municipalities', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore;
      const now = new Date();
      await setDoc(doc(db, 'municipalities/m1/members/alice'), {
        userId: 'alice', role: 'member', joinedAt: now, profileCompletedAt: null,
      });
      await setDoc(doc(db, 'municipalities/m2/members/alice'), {
        userId: 'alice', role: 'admin', joinedAt: now, profileCompletedAt: null,
      });
      await setDoc(doc(db, 'municipalities/m3/members/bob'), {
        userId: 'bob', role: 'member', joinedAt: now, profileCompletedAt: null,
      });
    });

    // Spy on getDb() so the service uses the authenticated-context Firestore
    // from the rules-testing environment.  The collectionGroup rule requires
    // auth (resource.data.userId == request.auth.uid), so we use the context
    // for 'alice' — the user whose memberships we're querying.
    const aliceDb = env.authenticatedContext('alice').firestore() as unknown as Firestore;
    vi.spyOn(firebaseModule, 'getDb').mockReturnValue(aliceDb);

    const memberships = await getUserMemberships('alice');

    expect(memberships.map((m) => m.municipalityId).sort()).toEqual(['m1', 'm2']);
    expect(memberships.find((m) => m.municipalityId === 'm2')?.role).toBe('admin');

    vi.restoreAllMocks();
  });

  it('returns empty for a user with no memberships', async () => {
    const nobodyDb = env.authenticatedContext('nobody').firestore() as unknown as Firestore;
    vi.spyOn(firebaseModule, 'getDb').mockReturnValue(nobodyDb);

    const memberships = await getUserMemberships('nobody');
    expect(memberships).toEqual([]);

    vi.restoreAllMocks();
  });
});
