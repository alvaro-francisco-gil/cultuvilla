// REST-based reset for the Firestore + Auth emulators.
// Mirrors packages/shared/test/helpers/firebaseEmulator.ts so functions tests
// don't have to depend on the shared workspace.

function getProjectId(): string {
  return process.env.GCLOUD_PROJECT || process.env.TEST_PROJECT_ID || 'cultuvilla-test';
}

function getFirestoreUrl(): string {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) throw new Error('FIRESTORE_EMULATOR_HOST not set');
  return `http://${host}`;
}

function getAuthUrl(): string {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) throw new Error('FIREBASE_AUTH_EMULATOR_HOST not set');
  return `http://${host}`;
}

async function httpDelete(url: string): Promise<void> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '');
    throw new Error(`DELETE ${url} failed: ${res.status} ${res.statusText} ${body}`);
  }
}

export async function clearFirestore(): Promise<void> {
  await httpDelete(
    `${getFirestoreUrl()}/emulator/v1/projects/${getProjectId()}/databases/(default)/documents`,
  );
}

export async function clearAuthAccounts(): Promise<void> {
  await httpDelete(`${getAuthUrl()}/emulator/v1/projects/${getProjectId()}/accounts`);
}

export async function resetEmulators(): Promise<void> {
  await Promise.all([clearFirestore(), clearAuthAccounts()]);
}
