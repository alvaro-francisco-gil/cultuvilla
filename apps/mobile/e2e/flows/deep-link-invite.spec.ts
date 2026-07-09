import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';

// Invite deep links (/village/<id>/join, /o/<id>/join) have no 1:1 route file
// under app/ — unlike content links (/event/<id>). On web, expo-router resolves
// URLs by file route, so these must exist as real routes that redirect into the
// target carrying the join intent. Regression guard for the "invite vecino link
// opens the not-found screen on web" bug: assert the invited banner renders.
test('village invite deep link lands on the village with the invited banner', async ({
  page,
}) => {
  await page.goto(`/village/${fixtures.village.docId}/join`);
  await expect(page.getByText(fixtures.village.name)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Te han invitado a unirte a este pueblo')).toBeVisible();
});

test('org invite deep link lands on the org with the invited banner', async ({ page }) => {
  await page.goto(`/o/${fixtures.org.docId}/join`);
  await expect(page.getByText('Te han invitado a unirte a este grupo')).toBeVisible({
    timeout: 30_000,
  });
});
