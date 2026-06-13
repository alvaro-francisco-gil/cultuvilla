// Storage Rules e2e test for /municipalities/{municipalityId}/images/{imageId}.
//
// Regression: village admins upload community cover images via
// `uploadMunicipalityImage`, which writes to
// `municipalities/{id}/images/{id}`. storage.rules had no match for that
// path, so the default-deny rejected every upload with a Storage permission
// error (see apps/mobile/app/village/[villageId]/admin/community.tsx).
//
// Uses @firebase/rules-unit-testing to mount the live storage.rules file
// against the storage emulator and execute uploads under different auth
// contexts. The returned storage() instance works with the v9 modular API.
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // "‰PNG" magic bytes

beforeAll(async () => {
  const rules = readFileSync(resolve(__dirname, '../../../../storage.rules'), 'utf8');
  env = await initializeTestEnvironment({
    projectId: process.env.TEST_PROJECT_ID || 'cultuvilla-rules-test',
    storage: { rules, host: '127.0.0.1', port: 9199 },
  });
});

beforeEach(async () => {
  await env.clearStorage();
});

afterAll(async () => {
  await env.cleanup();
});

describe('storage.rules — /municipalities/{municipalityId}/images/{imageId}', () => {
  it('an authenticated user can upload a community image', async () => {
    const alice = env.authenticatedContext('alice').storage() as unknown as FirebaseStorage;
    await assertSucceeds(
      uploadBytes(ref(alice, 'municipalities/m1/images/cover.png'), PNG, {
        contentType: 'image/png',
      }),
    );
  });

  it('an unauthenticated user cannot upload a community image', async () => {
    const anon = env.unauthenticatedContext().storage() as unknown as FirebaseStorage;
    await assertFails(
      uploadBytes(ref(anon, 'municipalities/m1/images/cover.png'), PNG, {
        contentType: 'image/png',
      }),
    );
  });

  it('a non-image upload is rejected', async () => {
    const alice = env.authenticatedContext('alice').storage() as unknown as FirebaseStorage;
    await assertFails(
      uploadBytes(ref(alice, 'municipalities/m1/images/notes.txt'), PNG, {
        contentType: 'text/plain',
      }),
    );
  });
});
