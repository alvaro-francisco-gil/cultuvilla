import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin } from '../lib/fixtureLogin';
import { findRegistration, waitFor } from '../lib/emulatorState';

test.describe('register a family persona', () => {
  test('user signs up a dependent persona for an event', async ({ page }) => {
    await page.goto('/');
    await fixtureLogin(page, fixtures.attendee.email);

    await page.goto(`/event/${fixtures.event.docId}`);
    const fab = page.getByTestId('register-fab');
    await expect(fab).toBeVisible({ timeout: 30_000 });
    await fab.click();

    await page.getByTestId(`attendee-row-${fixtures.dependentPerson.docId}`).click();
    await page.getByTestId('attendee-confirm').click();

    const registration = await waitFor(
      () => findRegistration({ eventId: fixtures.event.docId, personId: fixtures.dependentPerson.docId }),
      (r) => r?.status === 'confirmed',
      { timeoutMs: 20_000 },
    );
    expect(registration?.status).toBe('confirmed');
  });
});
