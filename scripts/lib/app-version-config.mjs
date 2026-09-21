/**
 * Pure payload construction for the `config/appVersion` doc — the force-update
 * gate clients read on launch (`appConfigService` → `resolveVersionGate`).
 *
 * `resolveAppVersionConfig` itself is pure so the resolution rules below stay
 * unit-testable; the only IO is reading the app's own store URLs at import.
 */

import { currentStoreUrl } from './app-stores.mjs';

const SEMVER = /^\d+\.\d+\.\d+$/;

/** Pre-release default: never force-block (AGENTS.md "Versioning & releases"). */
export const DEFAULT_MIN_SUPPORTED = '0.0.0';

/**
 * Where a walled client is sent to update. The same across envs — one published
 * app per store.
 *
 * iOS is READ from `apps/mobile/lib/appStores.ts` rather than restated here. A
 * second copy is exactly how the pre-launch placeholder `id000000000` survived
 * into the published 1.x line: every force-updated user would have been sent to
 * a dead App Store page.
 *
 * Android is deliberately NOT read from there. `APP_STORES.android` gates what
 * the *web build advertises* and stays empty until the Play listing is public,
 * but a walled tester already has access to that listing and still needs
 * somewhere to get the update.
 */
export const STORE_URL = {
  ios: currentStoreUrl('ios'),
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
export function resolveAppVersionConfig({ latest, minSupported, stored, defaultLatest, storeUrl = STORE_URL }) {
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

  // A blank URL would leave the gate's only button inert, walling the fleet
  // with no way off. Fail the write instead of shipping that.
  for (const key of ['ios', 'android']) {
    if (!storeUrl[key]) throw new Error(`storeUrl.${key} is empty — the force-update gate would have nowhere to send anyone`);
  }

  return {
    payload: {
      ios: { minSupported: resolvedMin, latest: resolvedLatest },
      android: { minSupported: resolvedMin, latest: resolvedLatest },
      storeUrl,
    },
    minSource: minSupported ? 'explicit' : storedMin ? 'preserved' : 'default',
    latestSource: latest ? 'explicit' : 'app.config.ts',
  };
}
