import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';

// Org invite deep links (/<pueblo>/entidad/<ref>/unirse) need a route file of
// their own: on web, expo-router resolves URLs by file route, so the `unirse`
// suffix must exist as a real route that redirects into the org carrying the
// join intent. Regression guard for the "invite link opens the not-found screen
// on web" bug: assert the invited banner renders.
//
// Villages have no invite link: joining one is open self-service. Only
// organizations still use the shared invite machinery.
test('org invite deep link lands on the org with the invited banner', async ({ page }) => {
  await page.goto(`${fixtures.org.path}/unirse`);
  await expect(page.getByText('Te han invitado a unirte a este grupo')).toBeVisible({
    timeout: 30_000,
  });
});
