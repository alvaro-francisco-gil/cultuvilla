import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin } from '../lib/fixtureLogin';
import { getPlaceStatus, waitFor } from '../lib/emulatorState';

test.describe('optimistic content moderation', () => {
  test('admin soft-hides a place from the edit screen', async ({ page }) => {
    await page.goto('/');
    await fixtureLogin(page, fixtures.admin.email);

    const currentStatus = await getPlaceStatus(fixtures.village.docId, fixtures.place.docId);
    if (currentStatus === 'hidden') return;

    await page.goto(`/village/${fixtures.village.docId}/place/${fixtures.place.docId}`);
    await expect(page.getByText(fixtures.place.name)).toBeVisible({ timeout: 30_000 });

    await page.goto(`/village/${fixtures.village.docId}/place/${fixtures.place.docId}/edit`);
    await expect(page.getByTestId('place-edit-name-input')).toHaveValue(fixtures.place.name, {
      timeout: 30_000,
    });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('place-delete').click();

    await waitFor(
      () => getPlaceStatus(fixtures.village.docId, fixtures.place.docId),
      (status) => status === 'hidden',
      { timeoutMs: 20_000 },
    );
  });
});
