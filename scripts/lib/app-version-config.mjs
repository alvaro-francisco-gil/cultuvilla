/**
 * Pure payload construction for the `config/appVersion` doc — the force-update
 * gate clients read on launch (`appConfigService` → `resolveVersionGate`).
 *
 * No IO here so the resolution rules below are unit-testable.
 */

const SEMVER = /^\d+\.\d+\.\d+$/;

/** Pre-release default: never force-block (AGENTS.md "Versioning & releases"). */
export const DEFAULT_MIN_SUPPORTED = '0.0.0';

/** Store URLs are the same across envs — one published app per store. */
export const STORE_URL = {
  ios: 'https://apps.apple.com/app/id000000000',
  android: 'https://play.google.com/store/apps/details?id=com.cultuvilla.app',
};

/**
 * Resolve what to write, given the requested values and whatever is already
 * stored.
 *
 * `minSupported` is a deliberate product decision (raising it walls every older
 * client), while `latest` changes on every release. Because the doc is written
 * whole (`merge: false`) so its shape stays defined in one place, an omitted
 * `--min` used to silently reset a deliberate wall back to 0.0.0. It now
 * defaults to the STORED value instead: omitting it never changes the wall, and
 * only an explicit `--min` moves it.
 */
export function resolveAppVersionConfig({ latest, minSupported, stored, defaultLatest }) {
  // A blank workflow input arrives as an empty string; treat it as "not given"
  // so it falls through to the default/preserve path instead of failing.
  const given = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
  latest = given(latest);
  minSupported = given(minSupported);

  const resolvedLatest = latest ?? defaultLatest;
  if (!resolvedLatest) throw new Error('latest is required (no --latest and no app.config.ts version)');
  if (!SEMVER.test(resolvedLatest)) throw new Error(`latest must be MAJOR.MINOR.PATCH, got "${resolvedLatest}"`);

  const storedMin = stored?.ios?.minSupported ?? stored?.android?.minSupported ?? null;
  const resolvedMin = minSupported ?? storedMin ?? DEFAULT_MIN_SUPPORTED;
  if (!SEMVER.test(resolvedMin)) throw new Error(`minSupported must be MAJOR.MINOR.PATCH, got "${resolvedMin}"`);

  return {
    payload: {
      ios: { minSupported: resolvedMin, latest: resolvedLatest },
      android: { minSupported: resolvedMin, latest: resolvedLatest },
      storeUrl: STORE_URL,
    },
    minSource: minSupported ? 'explicit' : storedMin ? 'preserved' : 'default',
    latestSource: latest ? 'explicit' : 'app.config.ts',
  };
}
