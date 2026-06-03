// Integration test: passwordless email-link sign-in against the Auth emulator.
// Mirrors the mobile-app flow in apps/mobile/lib/auth/AuthContext.tsx — call
// sendSignInLinkToEmail, retrieve the link from the emulator's oobCodes REST
// endpoint (which captures every email the emulator would have sent), then
// complete the sign-in with signInWithEmailLink and assert the resulting
// user. No real email infrastructure required.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  type Auth,
} from 'firebase/auth';

const PROJECT_ID = process.env.TEST_PROJECT_ID || 'cultuvilla-test';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const AUTH_URL = `http://${AUTH_HOST}`;
const CONTINUE_URL = `https://${PROJECT_ID}.web.app/finish`;

interface OobCode {
  email: string;
  oobCode: string;
  oobLink: string;
  requestType: string;
}

async function fetchOobCodeForEmail(email: string): Promise<OobCode> {
  const res = await fetch(`${AUTH_URL}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  if (!res.ok) throw new Error(`oobCodes fetch failed: ${String(res.status)}`);
  const { oobCodes } = (await res.json()) as { oobCodes: OobCode[] };
  // Latest code first — the emulator appends, so reverse and pick the newest
  // entry for this email. Tests share the emulator across files.
  const found = [...oobCodes].reverse().find(
    (c) => c.email === email && c.requestType === 'EMAIL_SIGNIN',
  );
  if (!found) {
    throw new Error(
      `No EMAIL_SIGNIN oobCode found for ${email}. Got: ${JSON.stringify(oobCodes)}`,
    );
  }
  return found;
}

async function clearAccounts(): Promise<void> {
  await fetch(`${AUTH_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
    method: 'DELETE',
  });
}

let app: FirebaseApp;
let auth: Auth;

beforeAll(() => {
  app = initializeApp(
    {
      apiKey: 'fake-api-key',
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
      projectId: PROJECT_ID,
    },
    'email-link-integration',
  );
  auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_URL, { disableWarnings: true });
});

beforeEach(async () => {
  await clearAccounts();
  if (auth.currentUser) await signOut(auth);
});

afterAll(async () => {
  if (auth.currentUser) await signOut(auth);
  await deleteApp(app);
});

describe('email-link sign-in (emulator)', () => {
  it('round-trips sendSignInLinkToEmail → emulator oobLink → signInWithEmailLink', async () => {
    const email = `link-${String(Date.now())}@cultuvilla.test`;

    await sendSignInLinkToEmail(auth, email, {
      url: CONTINUE_URL,
      handleCodeInApp: true,
    });

    const captured = await fetchOobCodeForEmail(email);
    expect(captured.oobLink).toContain('mode=signIn');
    expect(captured.oobLink).toContain(`oobCode=${captured.oobCode}`);
    expect(isSignInWithEmailLink(auth, captured.oobLink)).toBe(true);

    const cred = await signInWithEmailLink(auth, email, captured.oobLink);
    expect(cred.user.email).toBe(email);
    expect(auth.currentUser?.uid).toBe(cred.user.uid);
  });

  it('rejects signInWithEmailLink when the email does not match the link', async () => {
    const requested = `mismatch-${String(Date.now())}@cultuvilla.test`;
    const wrong = `someone-else-${String(Date.now())}@cultuvilla.test`;

    await sendSignInLinkToEmail(auth, requested, {
      url: CONTINUE_URL,
      handleCodeInApp: true,
    });

    const captured = await fetchOobCodeForEmail(requested);
    await expect(signInWithEmailLink(auth, wrong, captured.oobLink)).rejects.toThrow();
    expect(auth.currentUser).toBeNull();
  });

  it('signs the same user back in on a second link without duplicating accounts', async () => {
    const email = `repeat-${String(Date.now())}@cultuvilla.test`;

    await sendSignInLinkToEmail(auth, email, { url: CONTINUE_URL, handleCodeInApp: true });
    const first = await fetchOobCodeForEmail(email);
    const firstCred = await signInWithEmailLink(auth, email, first.oobLink);
    const firstUid = firstCred.user.uid;
    await signOut(auth);

    await sendSignInLinkToEmail(auth, email, { url: CONTINUE_URL, handleCodeInApp: true });
    const second = await fetchOobCodeForEmail(email);
    const secondCred = await signInWithEmailLink(auth, email, second.oobLink);

    expect(secondCred.user.uid).toBe(firstUid);
  });
});
