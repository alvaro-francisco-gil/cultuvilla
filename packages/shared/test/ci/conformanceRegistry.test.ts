import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The conformance gate (scripts/check-dev-conformance.mjs) only walks the
// collections in its hand-authored REGISTRY. A top-level collection nobody
// registers is never parsed against its converter, so a schema change to it
// can reach beta/prod and crash readers with the gate reporting green. The
// script's own drift guard only *warns* about unregistered roots, and only for
// roots that already hold data — so a brand-new collection slips through twice.
//
// That is exactly what happened to vocabularyTerms / vocabularyDefinitions: they
// shipped unregistered, and the very next change to them altered their schema.
// This test makes the omission a build failure instead of a warning.

const repoRoot = resolve(__dirname, '../../../..');
const refs = readFileSync(resolve(repoRoot, 'packages/shared/src/firebase/refs/admin.ts'), 'utf-8');
const gate = readFileSync(resolve(repoRoot, 'scripts/check-dev-conformance.mjs'), 'utf-8');

/**
 * Top-level collections the gate deliberately does not walk. Empty, and worth
 * keeping that way: an entry here is a collection whose stored data can drift
 * under its converter without any deploy noticing.
 *
 * This is not a way to make the test pass. Registering a collection starts
 * gating promotions on data the gate has never walked, so an entry belongs
 * here only until someone confirms that env's data conforms — then it goes.
 */
const NOT_YET_GATED: Record<string, string> = {};

// Top-level factories take only `db` — nested ones also take a parent id.
const topLevelFactories = [
  ...refs.matchAll(/^export const (\w+Collection) = \(db: Firestore\) =>/gm),
].map((m) => m[1]);

describe('conformance gate registry', () => {
  it('finds the top-level collection factories it is meant to police', () => {
    // Guards the regex: if refs/admin.ts changes shape, fail loudly rather than
    // pass by checking an empty list.
    expect(topLevelFactories.length).toBeGreaterThan(10);
    expect(topLevelFactories).toContain('vocabularyTermsCollection');
  });

  it.each(topLevelFactories.filter((f) => !(f in NOT_YET_GATED)))(
    'walks %s',
    (factory) => {
      expect(gate).toMatch(new RegExp(`coll: \\(db\\) => ${factory}\\(db\\)`));
    },
  );

  it('keeps no stale exceptions — an excepted collection must still exist', () => {
    for (const factory of Object.keys(NOT_YET_GATED)) {
      expect(topLevelFactories).toContain(factory);
    }
  });
});
