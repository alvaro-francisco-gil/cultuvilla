/**
 * Shared `--env` / `--confirm` argument gate for env-targeting admin scripts.
 *
 * Parses `--env=dev|beta|prod` (default dev) from argv and enforces that
 * beta/prod carry an explicit `--confirm`, mirroring seed-app-version-config.mjs.
 * Returns the env alias to hand straight to initAdminForEnv. Exits non-zero on a
 * missing --confirm so a stray invocation can't silently write a shared env.
 *
 * Dev is autonomous (no --confirm needed); beta/prod are off-limits without
 * explicit intent (see AGENTS.md branch model + the firebase-admin-dev skill).
 */
export function parseEnvConfirm(argv = process.argv.slice(2)) {
  const args = {};
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    args[key] = value ?? true;
  }
  const env = typeof args.env === 'string' ? args.env : 'dev';

  if ((env === 'beta' || env === 'prod') && args.confirm !== true) {
    console.error(
      `Refusing to write ${env} without --confirm. ` +
        `Beta/prod are off-limits without explicit intent (see AGENTS.md).`,
    );
    process.exit(1);
  }
  return env;
}
