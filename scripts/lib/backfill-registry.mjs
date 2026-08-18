/**
 * Pure decision logic for the backfill registry.
 *
 * NO Firestore, NO filesystem, NO credentials — so it stays unit-testable with
 * `node --test` and the rules it encodes can be asserted without an emulator.
 * All IO lives in backfill-harness.mjs.
 *
 * THE MODEL: a backfill is a script that mutates existing data to match a
 * schema change. Running it is NOT automatic — code deploys on merge, data does
 * not. The registry makes "has this run in env X?" a machine-checkable fact
 * (a marker doc) instead of a CHANGELOG sentence a human has to remember.
 *
 * WHY `phase` AND NOT A VERSION GATE: Órdago gates backfills on a semver
 * release because it ships store binaries it cannot force-upgrade, so it needs
 * expand/migrate/contract windows. Cultuvilla is web-first and deploys on merge
 * — the fleet upgrades on refresh. The axis that actually matters here is
 * ORDERING AROUND THE DEPLOY, because the strict Zod converters make it
 * bidirectional:
 *
 *   pre-deploy  — the new code cannot read the old data. Adding a required
 *                 field is this: the converter throws on any doc missing it, so
 *                 the data must be fixed BEFORE the code that reads it ships.
 *   post-deploy — the old code cannot read the new data. Dropping a field is
 *                 this: the currently-deployed converter still requires it, so
 *                 it can only be removed AFTER the new code is live.
 *   none        — never gates a deploy (audits, and one-offs already run
 *                 everywhere before this registry existed).
 */

export const KINDS = ['backfill', 'cleanup', 'migration', 'audit'];
export const PHASES = ['pre-deploy', 'post-deploy', 'none'];
export const ENVS = ['dev', 'beta', 'prod'];

/** `_admin/backfills/markers/{id}` — 4 segments, so it is a DOCUMENT path.
 *  An odd segment count is a COLLECTION and `db.doc()` throws at runtime. */
export function markerPath(id) {
  return `_admin/backfills/markers/${id}`;
}

function fail(field, msg) {
  throw new Error(`invalid backfill meta: ${field} ${msg}`);
}

export function validateMeta(meta) {
  if (!meta || typeof meta !== 'object') fail('meta', 'must be an object');
  if (typeof meta.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(meta.id)) {
    fail('id', 'must be a non-empty kebab-case string');
  }
  if (!KINDS.includes(meta.kind)) fail('kind', `must be one of ${KINDS.join('|')}`);
  if (typeof meta.description !== 'string' || meta.description.length === 0) {
    fail('description', 'must be a non-empty string');
  }
  if (!PHASES.includes(meta.phase)) fail('phase', `must be one of ${PHASES.join('|')}`);
  if (!Array.isArray(meta.envs) || meta.envs.length === 0 || meta.envs.some((e) => !ENVS.includes(e))) {
    fail('envs', `must be a non-empty subset of ${ENVS.join('|')}`);
  }
  if (typeof meta.idempotent !== 'boolean') fail('idempotent', 'must be a boolean');
  if (typeof meta.owner !== 'string' || meta.owner.length === 0) fail('owner', 'must be a non-empty string');

  const autoApply = meta.autoApply ?? [];
  if (!Array.isArray(autoApply) || autoApply.some((e) => !ENVS.includes(e))) {
    fail('autoApply', `must be a subset of ${ENVS.join('|')}`);
  }
  if (autoApply.some((e) => !meta.envs.includes(e))) {
    fail('autoApply', 'must be a subset of envs — cannot auto-apply to an env the backfill does not target');
  }
  // The poller runs these unattended with no human reading the diff. A
  // non-idempotent script re-run by a retry would double-apply its effect.
  if (autoApply.length > 0 && meta.idempotent !== true) {
    fail('autoApply', 'requires idempotent: true — an unattended re-run must be a no-op');
  }

  // An audit writes nothing, so it never gets a marker. Any gating phase would
  // therefore block the deploy forever with no way to satisfy it.
  if (meta.kind === 'audit' && meta.phase !== 'none') {
    fail('phase', "must be 'none' for kind 'audit' — an audit writes no marker, so it could never be satisfied");
  }
  return meta;
}

const applicable = (m, env) => Array.isArray(m.envs) && m.envs.includes(env) && m.kind !== 'audit';

/**
 * Backfills that MUST have run in `env` before deploying to it. A missing
 * marker here fails the deploy — the same posture as the conformance gate, and
 * for the same reason: shipping without it crashes reads.
 */
export function selectPreDeploy(metas, env) {
  return (metas || []).filter((m) => applicable(m, env) && m.phase === 'pre-deploy');
}

/**
 * Backfills expected to run AFTER the deploy. Reported as a loud, NON-blocking
 * warning on the next deploy to that env: blocking would deadlock (the backfill
 * cannot run until the deploy it would be blocking has happened), and staying
 * silent is how a pending migration gets forgotten.
 */
export function selectPostDeploy(metas, env) {
  return (metas || []).filter((m) => applicable(m, env) && m.phase === 'post-deploy');
}

/** The subset the deploy may run unattended: opted in for this env and idempotent. */
export function selectAutoApplicable(metas, env) {
  return (metas || []).filter(
    (m) => applicable(m, env) && m.idempotent === true && Array.isArray(m.autoApply) && m.autoApply.includes(env),
  );
}

/** ids from `metas` with no completion marker for `env`. `getMarker` is async. */
export async function findMissingMarkers(metas, env, getMarker) {
  const missing = [];
  for (const meta of metas) {
    const data = await getMarker(meta.id);
    if (!data || !data[env]) missing.push(meta.id);
  }
  return missing;
}
