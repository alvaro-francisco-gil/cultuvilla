import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';
import { selectAutoApplicable, validateMeta } from '../lib/backfill-registry.mjs';
import { SENTINEL_RE, isMain, loadBackfills, parseArgs, requireConfirmForSharedEnv } from '../lib/backfill-harness.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('registry discovery', () => {
  it('discovers every registered backfill and validates its meta', async () => {
    const backfills = await loadBackfills();
    assert.ok(backfills.length > 0, 'expected at least one registered backfill');
    for (const { meta, run, file } of backfills) {
      assert.doesNotThrow(() => validateMeta(meta), `${file} has invalid meta`);
      assert.equal(typeof run, 'function', `${file} must export an async run(ctx)`);
    }
  });

  it('every dependsOn names a backfill that actually exists', async () => {
    // A typo'd or renamed id is silently ignored by topoSort (an absent dep
    // imposes no ordering), so it would drop the ordering guarantee without
    // failing anything. Catch it here instead.
    const backfills = await loadBackfills();
    const ids = new Set(backfills.map((b) => b.meta.id));
    for (const { meta, file } of backfills) {
      for (const dep of meta.dependsOn ?? []) {
        assert.ok(ids.has(dep), `${file}: dependsOn '${dep}' matches no registered backfill`);
      }
    }
  });

  it('orders the real registry so sources precede the projections that read them', async () => {
    // Regression guard for the ordering alphabetical sort gets BACKWARDS:
    // `municipality-people-barrio` writes the municipalityPeople projection,
    // and `person-visibility` patches `persons` — which fires
    // syncMunicipalityPeople and rewrites those rows. `m` < `p`, so without
    // dependsOn the projection would run first and be clobbered.
    const metas = (await loadBackfills()).map((b) => b.meta);
    for (const env of ['dev', 'beta', 'prod']) {
      const order = selectAutoApplicable(metas, env).map((m) => m.id);
      const projection = order.indexOf('municipality-people-barrio');
      const source = order.indexOf('person-visibility');
      if (projection === -1 || source === -1) continue;
      assert.ok(source < projection, `${env}: person-visibility must precede municipality-people-barrio`);
    }
  });

  it('assigns every backfill a unique id', async () => {
    const ids = (await loadBackfills()).map((b) => b.meta.id);
    assert.deepEqual(ids, [...new Set(ids)], 'duplicate ids would collide on one marker doc');
  });

  it('returns backfills sorted by id, so `list` output is stable', async () => {
    const ids = (await loadBackfills()).map((b) => b.meta.id);
    assert.deepEqual(ids, [...ids].sort());
  });

  // THE load-bearing safety property. Discovery imports each registered module,
  // and every backfill script reaches Firestore. If the `isMain(...)` guard were
  // dropped, `pnpm backfills:list` would silently RUN every backfill it found.
  it('does not execute a backfill or initialize firebase-admin while listing', async () => {
    assert.equal(admin.apps.length, 0, 'precondition: no admin app before discovery');
    await loadBackfills();
    assert.equal(admin.apps.length, 0, 'discovery initialized firebase-admin — the isMain() guard is not holding');
  });

  it('only imports files carrying the harness sentinel', async () => {
    // Legacy scripts connect to Firestore at module scope, so importing one
    // would fire it. The sentinel grep is what keeps them out.
    const registered = new Set((await loadBackfills()).map((b) => b.file));
    for (const dir of ['scripts', 'scripts/backfill']) {
      const abs = path.join(REPO_ROOT, dir);
      if (!existsSync(abs)) continue;
      for (const name of readdirSync(abs)) {
        if (!name.endsWith('.mjs')) continue;
        const rel = path.join(dir, name);
        const hasSentinel = SENTINEL_RE.test(readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
        if (registered.has(rel)) assert.ok(hasSentinel, `${rel} was imported without the sentinel`);
      }
    }
  });
});

describe('isMain', () => {
  it('is false for a module that is not the process entrypoint', () => {
    assert.equal(isMain('file:///some/other/module.mjs'), false);
  });
});

describe('parseArgs', () => {
  it('reads --flag=value and --flag value forms', () => {
    assert.equal(parseArgs(['--env=beta']).env, 'beta');
    assert.equal(parseArgs(['--env', 'beta']).env, 'beta');
    assert.equal(parseArgs(['--id=some-id']).id, 'some-id');
  });

  it('reads boolean flags and defaults them to false', () => {
    const on = parseArgs(['--apply', '--confirm', '--verbose']);
    assert.deepEqual([on.apply, on.confirm, on.verbose], [true, true, true]);
    const off = parseArgs([]);
    assert.deepEqual([off.apply, off.confirm, off.verbose, off.env, off.id], [false, false, false, null, null]);
  });

  it('does not swallow a following flag as a value', () => {
    assert.equal(parseArgs(['--env', '--apply']).env, null);
  });
});

describe('requireConfirmForSharedEnv', () => {
  it('lets dev through unconfirmed — dev is autonomous', () => {
    assert.doesNotThrow(() => requireConfirmForSharedEnv('dev', false));
  });

  it('refuses beta and prod without --confirm', () => {
    for (const env of ['beta', 'prod']) {
      assert.throws(() => requireConfirmForSharedEnv(env, false), /--confirm/);
      assert.doesNotThrow(() => requireConfirmForSharedEnv(env, true));
    }
  });
});
