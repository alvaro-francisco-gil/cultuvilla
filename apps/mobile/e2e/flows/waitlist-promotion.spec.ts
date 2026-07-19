import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin, fixtureSignOut } from '../lib/fixtureLogin';
import { findRegistration, getRegistration, waitFor } from '../lib/emulatorState';

test.describe('capacity waitlist promotion', () => {
  test('full event waitlists a user, then organizer removal promotes them', async ({ page }) => {
    await page.goto('/');
    await fixtureLogin(page, fixtures.attendee.email);

    await page.goto(`/event/${fixtures.capacityEvent.docId}`);
    const fab = page.getByTestId('register-fab');
    await expect(fab).toBeVisible({ timeout: 30_000 });
    await fab.click();
    await page.getByTestId(`attendee-row-${fixtures.attendee.personId}`).click();
    await page.getByTestId('attendee-confirm').click();

    await waitFor(
      () => findRegistration({ eventId: fixtures.capacityEvent.docId, personId: fixtures.attendee.personId }),
      (r) => r?.status === 'waitlisted',
      { timeoutMs: 20_000 },
    );

    await fixtureSignOut(page);
    await fixtureLogin(page, fixtures.admin.email);
    await page.goto(`/event/${fixtures.capacityEvent.docId}`);

    const removeSeeded = page.getByTestId(`remove-attendee-${fixtures.capacityEvent.seededRegistrationId}`);
    await expect(removeSeeded).toBeVisible({ timeout: 30_000 });
    page.once('dialog', (dialog) => dialog.accept());
    await removeSeeded.click();

    await waitFor(
      () => getRegistration(fixtures.capacityEvent.docId, fixtures.capacityEvent.seededRegistrationId),
      (r) => r === null,
      { timeoutMs: 20_000 },
    );
    const promoted = await waitFor(
      () => findRegistration({ eventId: fixtures.capacityEvent.docId, personId: fixtures.attendee.personId }),
      (r) => r?.status === 'confirmed',
      { timeoutMs: 20_000 },
    );
    expect(promoted?.status).toBe('confirmed');
  });
});
