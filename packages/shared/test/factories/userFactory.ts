// Test user helpers for the Auth emulator.
// Creates anonymous-equivalent users via the Auth REST endpoint so tests
// can run as a specific UID without requiring a real provider.

let counter = 0;
const nextId = () => ++counter;

export function makeUniqueEmail(prefix = 'test'): string {
  return `${prefix}-${String(Date.now())}-${String(nextId())}@cultuvilla.test`;
}

export function makeTestUid(prefix = 'user'): string {
  return `${prefix}-${String(nextId())}-${String(Date.now())}`;
}

export interface TestUser {
  uid: string;
  email: string;
  displayName: string;
}

/**
 * Creates a user record in the Auth emulator via REST.
 * Returns the synthesized user info; sign-in is not performed.
 */
export async function createAuthUser(input: Partial<TestUser> = {}): Promise<TestUser> {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) throw new Error('[userFactory] FIREBASE_AUTH_EMULATOR_HOST not set');
  const projectId = process.env.TEST_PROJECT_ID || 'cultuvilla-test';

  const user: TestUser = {
    uid: input.uid ?? makeTestUid(),
    email: input.email ?? makeUniqueEmail(),
    displayName: input.displayName ?? 'Test User',
  };

  const url = `http://${host}/identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts?key=fake-api-key`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      localId: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`createAuthUser failed: ${String(res.status)} ${res.statusText} ${body}`);
  }
  return user;
}
