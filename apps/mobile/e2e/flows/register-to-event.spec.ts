import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin } from '../lib/fixtureLogin';
import { getEventConfirmedCount, listRegistrations, waitFor } from '../lib/emulatorState';

// The canonical first flow (plan D1): a real visitor journey over the web export
// against the Firebase emulator. The strong assertion is the backend effect
// (a registration + confirmedCount in Firestore), read via emulatorState — the
// portable half of the substrate that a native (Maestro) driver will reuse.
test.describe('register to an event', () => {
  test('anon sees feed → logs in → signs up → registration lands in Firestore', async ({ page }) => {
    // 1. Anonymous visitor lands on the public Explora feed and sees the event.
    await page.goto('/');
    await expect(page.getByText(fixtures.event.title)).toBeVisible({ timeout: 30_000 });

    // 2. Sign in as the seeded attendee via the emulator-only fixture-login seam
    //    (no Google OAuth, no UI typing).
    await fixtureLogin(page, fixtures.attendee.email);

    // 3. Open the event and sign up: register FAB → own persona row → confirm.
    await page.goto(`/event/${fixtures.event.docId}`);
    const fab = page.getByTestId('register-fab');
    await expect(fab).toBeVisible({ timeout: 30_000 });
    await fab.click();

    await page.getByTestId(`attendee-row-${fixtures.attendee.personId}`).click();
    await page.getByTestId('attendee-confirm').click();

    // 4. Strong assertion: the backend recorded the registration.
    await waitFor(
      () => getEventConfirmedCount(fixtures.event.docId),
      (n) => n >= 1,
      { timeoutMs: 20_000 },
    );
    const registrations = await listRegistrations(fixtures.event.docId);
    expect(registrations.length).toBeGreaterThan(0);

    // 5. And the UI reflects it — the FAB flips to the signed-up state ("Apuntado").
    await expect(fab).toHaveText(/Apuntad/, { timeout: 15_000 });
  });
});
