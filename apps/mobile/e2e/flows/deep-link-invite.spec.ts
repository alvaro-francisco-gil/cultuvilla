import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin, fixtureSignOut } from '../lib/fixtureLogin';

// Invite deep links (/village/<id>/join, /o/<id>/join) have no 1:1 route file
// under app/ — unlike content links (/event/<id>). On web, expo-router resolves
// URLs by file route, so these must exist as real routes that redirect into the
// target carrying the join intent. Regression guard for the "invite vecino link
// opens the not-found screen on web" bug: assert the invited banner renders.
test('village invite deep link lands on the village with the invited banner', async ({
  page,
}) => {
  await page.goto(`/village/${fixtures.village.docId}/join`);
  // The village name renders twice (compact header + hero title), so scope to
  // the first match — the assertion only needs the name present, not unique.
  await expect(page.getByText(fixtures.village.name).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Te han invitado a unirte a este pueblo')).toBeVisible();
});

test('org invite deep link lands on the org with the invited banner', async ({ page }) => {
  await page.goto(`/o/${fixtures.org.docId}/join`);
  await expect(page.getByText('Te han invitado a unirte a este grupo')).toBeVisible({
    timeout: 30_000,
  });
});

// Regression: a logged-in member tapping the invite link used to get stuck on a
// spinner because useDeepLinkRouter's web navigation raced the join-route
// redirect during the auth/profile load. It must simply land on the village
// (no invited banner — they're already a member).
test('village invite deep link lands an existing member on the village (no spinner)', async ({
  page,
}) => {
  await page.goto('/');
  await fixtureLogin(page, fixtures.attendee.email);
  await page.goto(`/village/${fixtures.village.docId}/join`);
  await expect(page.getByText(fixtures.village.name).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Te han invitado a unirte a este pueblo')).toBeHidden();
  await fixtureSignOut(page);
});
