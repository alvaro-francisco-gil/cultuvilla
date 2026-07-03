// Shared harness for emulator-backed Firestore tests (rules e2e + data
// integration). Mounts the live `firestore.rules` file against the Firestore
// emulator via @firebase/rules-unit-testing so every suite tests the *same*
// rules that ship, without each file re-implementing the readFileSync + env +
// lifecycle boilerplate.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, beforeEach, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

// firestore.rules lives at the repo root — four levels above this helper
// (packages/shared/test/helpers/ → repo root).
const RULES_PATH = resolve(__dirname, '../../../../firestore.rules');

function resolveProjectId(explicit?: string): string {
  return explicit ?? process.env.TEST_PROJECT_ID ?? 'cultuvilla-rules-test';
}

/**
 * Build a one-off RulesTestEnvironment. Prefer {@link useRulesTestEnv} in test
 * files; reach for this only when you need manual control over the lifecycle.
 */
export async function createRulesTestEnv(projectId?: string): Promise<RulesTestEnvironment> {
  const rules = readFileSync(RULES_PATH, 'utf8');
  return initializeTestEnvironment({
    projectId: resolveProjectId(projectId),
    firestore: { rules },
  });
}

/**
 * Register the standard emulator-test lifecycle for the current suite:
 * initialize once (`beforeAll`), reset Firestore between tests (`beforeEach`),
 * and clean up at the end (`afterAll`). Returns a getter for the live env.
 *
 * Call at the top level of a `describe`/module so the hooks register during
 * collection:
 *
 * ```ts
 * const getEnv = useRulesTestEnv();
 * it('...', () => { const db = asUser(getEnv(), 'alice'); ... });
 * ```
 */
export function useRulesTestEnv(projectId?: string): () => RulesTestEnvironment {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await createRulesTestEnv(projectId);
  });

  beforeEach(async () => {
    await env.clearFirestore();
  });

  afterAll(async () => {
    await env.cleanup();
  });

  return () => env;
}
