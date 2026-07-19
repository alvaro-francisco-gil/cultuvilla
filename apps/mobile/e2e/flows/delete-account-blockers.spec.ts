import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin } from '../lib/fixtureLogin';

test.describe('account deletion guard', () => {
  test('sole village/org admin sees blockers before deleting their account', async ({ page }) => {
    await page.goto('/');
    await fixtureLogin(page, fixtures.admin.email);

    await page.goto('/settings/delete-account');
    await expect(page.getByText('Antes de eliminar tu cuenta, debes ceder los permisos de administrador en:')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Altozano de Prueba/)).toBeVisible();
    await expect(page.getByText(/Ayuntamiento de Altozano/)).toBeVisible();
  });
});
