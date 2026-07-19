import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin } from '../lib/fixtureLogin';
import { isVillageMember, waitFor } from '../lib/emulatorState';

test.describe('village self-join', () => {
  test('member of another village joins an active village directly', async ({ page }) => {
    await page.goto('/');
    await fixtureLogin(page, fixtures.joiner.email);

    await page.goto(`/village/${fixtures.joinVillage.docId}`);
    const join = page.getByTestId('village-join-action');
    await expect(join).toBeVisible({ timeout: 30_000 });
    await join.click();
    await page.getByTestId('join-village-confirm').click();

    await waitFor(
      () => isVillageMember(fixtures.joinVillage.docId, fixtures.joiner.uid),
      (member) => member === true,
      { timeoutMs: 20_000 },
    );
    await expect(page.getByTestId('village-add-content-action')).toBeVisible({ timeout: 15_000 });
  });
});
