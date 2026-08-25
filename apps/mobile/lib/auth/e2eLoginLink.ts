/**
 * Pure helpers for the E2E fixture-login seam in AuthContext.
 *
 * They contain NO auth call and NO emulator wiring — only string predicates —
 * which is exactly why they live outside the seam file: they are the part worth
 * unit-testing, and the `check:no-test-login-leak` gate's job is to confine the
 * *capability*, not every string that mentions it. AuthContext still owns the
 * single `signInWithEmailAndPassword` call.
 */

/**
 * Hosts an E2E fixture session may be minted against.
 *
 * Loopback covers the web (Playwright) driver. `10.0.2.2` is the Android
 * emulator's NAT alias for the host machine's loopback interface — the native
 * (Maestro) driver's only way to reach emulators running on the CI runner,
 * since `127.0.0.1` inside an AVD is the *device*. It is a non-routable,
 * AVD-only address: a physical device or a real network has nothing there, so
 * admitting it widens the blast radius by zero.
 *
 * The value is read from `getAuth().emulatorConfig.host`, so this predicate is
 * only ever true when the SDK has ALREADY been repointed at an emulator — it is
 * the fail-closed physics guard, not a configuration choice.
 */
export const E2E_EMULATOR_HOSTS = ['127.0.0.1', 'localhost', '::1', '10.0.2.2'] as const;

export function isE2EEmulatorHost(host: string | undefined | null): boolean {
  return (
    typeof host === 'string' && (E2E_EMULATOR_HOSTS as readonly string[]).includes(host)
  );
}

export interface E2ELoginLink {
  email: string;
  password: string;
}

/** Query parameter the native driver hands credentials over. */
export const E2E_LOGIN_PARAM = 'e2eLogin';

/**
 * Parse `<scheme>://?e2eLogin=<email>%7C<password>` into credentials.
 *
 * ONE parameter, `|`-separated, deliberately: Maestro delivers the link through
 * `adb shell am start -d <url>`, and an unescaped `&` there is eaten by the
 * device shell — a two-parameter form would arrive with the password silently
 * missing. The pipe is percent-encoded (`%7C`) in the link and decoded here.
 *
 * Returns `null` for any URL without the parameter, so ordinary deep links
 * (`cultuvilla://event/<id>`) fall through untouched. An explicitly empty value
 * is a valid link meaning "sign out" — the caller distinguishes it from `null`.
 */
export function parseE2ELoginLink(url: string): E2ELoginLink | null {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return null;
  const raw = new URLSearchParams(url.slice(queryStart + 1)).get(E2E_LOGIN_PARAM);
  if (raw === null) return null;
  const separator = raw.indexOf('|');
  if (separator === -1) return { email: raw, password: '' };
  return { email: raw.slice(0, separator), password: raw.slice(separator + 1) };
}
