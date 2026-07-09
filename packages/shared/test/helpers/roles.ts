// Auth-context helpers for emulator-backed Firestore tests. Name the actor at
// the call site (`asUser(env, 'alice')`, `asAdmin(env, 'sadmin')`) instead of
// spelling out `env.authenticatedContext(uid).firestore()` and hand-seeding the
// `admins/` doc in every file.
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import type {
  RulesTestContext,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

/** Firestore client scoped to an authenticated user `uid`. */
export function asUser(env: RulesTestEnvironment, uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

/**
 * Firestore client scoped to an authenticated user `uid` whose auth token
 * carries `email` as a verified claim (`request.auth.token.email` in rules) —
 * mirrors the real Firebase Auth ID token shape for testing rules that pin a
 * write to the caller's own verified email.
 */
export function asUserWithEmail(
  env: RulesTestEnvironment,
  uid: string,
  email: string,
): Firestore {
  return env.authenticatedContext(uid, { email }).firestore() as unknown as Firestore;
}

/** Firestore client with no auth (signed-out / anonymous request). */
export function asAnon(env: RulesTestEnvironment): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

/**
 * Run a seeding block with security rules disabled — the sanctioned way to set
 * up state a rule would otherwise forbid (create a doc that only a Cloud
 * Function may write, etc.).
 */
export function seed(
  env: RulesTestEnvironment,
  fn: (ctx: RulesTestContext) => Promise<void>,
): Promise<void> {
  return env.withSecurityRulesDisabled(fn);
}

/** Seed the app-admin marker doc (`admins/{uid}`) that the rules check. */
export function seedAdmin(env: RulesTestEnvironment, uid: string): Promise<void> {
  return seed(env, async (ctx) => {
    await setDoc(doc(ctx.firestore() as unknown as Firestore, `admins/${uid}`), {
      createdAt: new Date(),
    });
  });
}

/** Seed the `admins/{uid}` marker, then return that user's Firestore client. */
export async function asAdmin(env: RulesTestEnvironment, uid: string): Promise<Firestore> {
  await seedAdmin(env, uid);
  return asUser(env, uid);
}
