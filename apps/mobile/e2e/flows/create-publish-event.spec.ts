import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin } from '../lib/fixtureLogin';
import { findEvent, waitFor } from '../lib/emulatorState';

// An organizer creates an event through the 3-step wizard and it publishes. The
// location picker centres on the device's GPS position and confirms in one tap,
// so we grant Playwright a fake geolocation instead of driving the map search
// (which needs a Google key the emulator CI job doesn't carry). The strong
// assertion is the backend effect: a published events/{id} doc scoped to the
// organizer's village.
test.use({
  geolocation: { latitude: 39.4699, longitude: -0.3763 },
  permissions: ['geolocation'],
});

const NEW_EVENT_TITLE = 'Evento Creado E2E';

test.describe('create & publish an event', () => {
  test('organizer fills the wizard → event lands published in Firestore', async ({ page }) => {
    await page.goto('/');
    await fixtureLogin(page, fixtures.admin.email);

    await page.goto('/event/new');

    // Step 1 — basics. The admin is a member of the seeded village, so the form
    // renders (rather than the "join a village first" eligibility message) and
    // the village auto-selects to it.
    const title = page.getByTestId('event-title');
    await expect(title).toBeVisible({ timeout: 30_000 });
    await title.fill(NEW_EVENT_TITLE);
    await page.getByTestId('event-form-primary').click();

    // Step 2 — when & where. The datetime picker opens on "now" (a valid start),
    // so opening then confirming is enough.
    await page.getByTestId('startDate-trigger').click();
    await page.getByTestId('startDate-confirm').click();

    // Location: open, take the granted GPS fix, confirm once coords resolve.
    await page.getByTestId('event-location').click();
    await page.getByTestId('location-use-mine').click();
    const locationConfirm = page.getByTestId('location-confirm');
    await expect(locationConfirm).toBeEnabled({ timeout: 15_000 });
    await locationConfirm.click();

    await page.getByTestId('event-form-primary').click();

    // Step 3 — details are all optional; submit.
    await page.getByTestId('event-form-primary').click();

    // Strong assertion: a published event exists in the organizer's village.
    const created = await waitFor(
      () => findEvent({ municipalityId: fixtures.village.docId, title: NEW_EVENT_TITLE }),
      (e) => e !== null,
      { timeoutMs: 20_000 },
    );
    expect(created?.status).toBe('published');
  });
});
