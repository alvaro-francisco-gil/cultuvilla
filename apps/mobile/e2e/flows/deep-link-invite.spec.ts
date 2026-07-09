import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';

// Org invite deep links (/o/<id>/join) have no 1:1 route file under app/ —
// unlike content links (/event/<id>). On web, expo-router resolves URLs by file
// route, so this must exist as a real route that redirects into the org carrying
// the join intent. Regression guard for the "invite link opens the not-found
// screen on web" bug: assert the invited banner renders.
//
// Village invites were removed end to end (see the b24bd50 refactor): joining a
// village is open self-service, so there is no /village/<id>/join route and no
// invited banner. Only organizations still use the shared invite machinery.
test('org invite deep link lands on the org with the invited banner', async ({ page }) => {
  await page.goto(`/o/${fixtures.org.docId}/join`);
  await expect(page.getByText('Te han invitado a unirte a este grupo')).toBeVisible({
    timeout: 30_000,
  });
});
