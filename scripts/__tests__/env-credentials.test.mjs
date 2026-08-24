// Guards `initAdminForEnv` against the double-initializeApp crash that broke the
// v0.26.0 beta deploy: the auto-apply loop initializes admin to read markers,
// then executeBackfill initializes again for the first backfill, and
// firebase-admin throws on a second initializeApp for the default app.
//
// It stayed invisible for months because the loop `continue`s past every
// already-markered backfill, so executeBackfill was only ever reached on a
// deploy that had genuinely new auto-apply work — which v0.26.0 was the first
// to have.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import admin from 'firebase-admin';
import { initAdminForEnv } from '../lib/env-credentials.mjs';

describe('initAdminForEnv', () => {
  test('a second call for the same env reuses the app instead of throwing', () => {
    const first = initAdminForEnv('dev');
    assert.equal(first.projectId, 'villa-events');

    // This is the exact sequence the auto-apply loop performs.
    const second = initAdminForEnv('dev');
    assert.equal(second.projectId, 'villa-events');
    assert.equal(second.auth, 'reused');
    assert.equal(second.app, first.app, 'must hand back the same app, not a new one');
    assert.equal(admin.apps.length, 1, 'must not create a second default app');
  });

  test('refuses to reuse an app initialized for a different environment', () => {
    // dev is already initialized by the test above. Asking for beta in the same
    // process must fail loudly: handing back the dev app would write dev data
    // where beta was intended — silent cross-environment corruption.
    assert.throws(() => initAdminForEnv('beta'), /already initialized for project "villa-events".*expects "cultuvilla-beta"/s);
  });
});
