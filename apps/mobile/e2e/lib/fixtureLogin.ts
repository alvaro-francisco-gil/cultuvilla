import type { Page } from '@playwright/test';
import { E2E_PASSWORD } from './fixtures';

interface E2ESeam {
  login: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<unknown>;
}

// Signs in through the app's test-only fixture-login seam
// (window.__cultuvillaE2E), which AuthContext installs ONLY when the build
// points at the loopback Firebase emulator. No Google OAuth, no UI typing —
// this is the "shared substrate" the native (Maestro) driver will reuse later.
export async function fixtureLogin(
  page: Page,
  email: string,
  password: string = E2E_PASSWORD,
): Promise<void> {
  await page.waitForFunction(
    () => Boolean((window as unknown as { __cultuvillaE2E?: E2ESeam }).__cultuvillaE2E),
    undefined,
    { timeout: 30_000 },
  );
  await page.evaluate(
    ([e, p]) =>
      (window as unknown as { __cultuvillaE2E: E2ESeam }).__cultuvillaE2E.login(e, p),
    [email, password],
  );
}

export async function fixtureSignOut(page: Page): Promise<void> {
  await page.evaluate(() =>
    (window as unknown as { __cultuvillaE2E?: E2ESeam }).__cultuvillaE2E?.signOut(),
  );
}
