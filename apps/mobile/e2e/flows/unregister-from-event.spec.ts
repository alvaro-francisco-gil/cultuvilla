import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin } from '../lib/fixtureLogin';
import { findRegistration, waitFor } from '../lib/emulatorState';

test.describe('unregister from an event', () => {
  test('user removes their own persona from an event registration', async ({ page }) => {
    await page.goto('/');
    await fixtureLogin(page, fixtures.attendee.email);

    await page.goto(`/event/${fixtures.event.docId}`);
    const fab = page.getByTestId('register-fab');
    await expect(fab).toBeVisible({ timeout: 30_000 });

    let selfRegistration = await findRegistration({
      eventId: fixtures.event.docId,
      personId: fixtures.attendee.personId,
    });
    if (!selfRegistration) {
      await fab.click();
      await page.getByTestId(`attendee-row-${fixtures.attendee.personId}`).click();
      await page.getByTestId('attendee-confirm').click();
      selfRegistration = await waitFor(
        () => findRegistration({ eventId: fixtures.event.docId, personId: fixtures.attendee.personId }),
        (r) => r?.status === 'confirmed',
        { timeoutMs: 20_000 },
      );
    }
    expect(selfRegistration?.status).toBe('confirmed');

    await fab.click();
    await page.getByTestId(`attendee-row-${fixtures.attendee.personId}`).click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('attendee-confirm').click();

    await waitFor(
      () => findRegistration({ eventId: fixtures.event.docId, personId: fixtures.attendee.personId }),
      (r) => r === null,
      { timeoutMs: 20_000 },
    );
  });
});
