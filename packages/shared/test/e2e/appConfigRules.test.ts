// Firestore Rules e2e test for /config/{docId}.
//
// Uses @firebase/rules-unit-testing to mount the live firestore.rules file
// against the firestore emulator and execute requests under different auth
// contexts.
import { describe, it } from 'vitest';
import { assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRulesTestEnv } from '../helpers/rulesTestEnv';
import { asUser, asAnon, seed } from '../helpers/roles';

const getEnv = useRulesTestEnv();

const appVersionConfigPayload = () => ({
  ios: { minSupported: '1.0.0', latest: '1.0.0' },
  android: { minSupported: '1.0.0', latest: '1.0.0' },
  storeUrl: { ios: 'https://example.com/ios', android: 'https://example.com/android' },
});

describe('firestore.rules — /config/{docId}', () => {
  it('allows an unauthenticated client to read config', async () => {
    await seed(getEnv(), async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'config/appVersion'), appVersionConfigPayload());
    });
    const anonDb = asAnon(getEnv());
    await assertSucceeds(getDoc(doc(anonDb, 'config/appVersion')));
  });

  it('denies a client write to config', async () => {
    const userDb = asUser(getEnv(), 'uid-1');
    await assertFails(setDoc(doc(userDb, 'config/appVersion'), appVersionConfigPayload()));
  });
});
