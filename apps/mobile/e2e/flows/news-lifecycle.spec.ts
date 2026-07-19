import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';
import { fixtureLogin } from '../lib/fixtureLogin';
import { findNewsPost, waitFor } from '../lib/emulatorState';

test.describe('news lifecycle', () => {
  test('admin creates, edits, and deletes a news post', async ({ page }) => {
    const title = `Noticia E2E ${Date.now()}`;
    const editedTitle = `${title} editada`;

    await page.goto('/');
    await fixtureLogin(page, fixtures.admin.email);

    await page.goto(`/news/new?villageId=${fixtures.village.docId}`);
    await page.getByTestId('news-title').fill(title);
    await page.getByTestId('news-category').click();
    await page.getByTestId('news-category-fiesta').click();
    await page.getByTestId('news-form-primary').click();

    await page.getByTestId('news-block-text-0').fill('Contenido creado desde Playwright.');
    await page.getByTestId('news-form-primary').click();
    await page.getByTestId('news-form-primary').click();

    const created = await waitFor(
      () => findNewsPost({ municipalityId: fixtures.village.docId, title }),
      (post) => post?.status === 'active',
      { timeoutMs: 20_000 },
    );
    const postId = created!.id;

    await page.goto(`/news/new?newsId=${postId}`);
    await page.getByTestId('news-title').fill(editedTitle);
    await page.getByTestId('news-form-primary').click();
    await page.getByTestId('news-form-primary').click();
    await page.getByTestId('news-form-primary').click();

    await waitFor(
      () => findNewsPost({ municipalityId: fixtures.village.docId, title: editedTitle }),
      (post) => post?.id === postId,
      { timeoutMs: 20_000 },
    );

    await page.goto(`/news/new?newsId=${postId}`);
    await expect(page.getByTestId('news-title')).toHaveValue(editedTitle, { timeout: 30_000 });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('news-delete').click();

    await waitFor(
      () => findNewsPost({ municipalityId: fixtures.village.docId, title: editedTitle }),
      (post) => post === null,
      { timeoutMs: 20_000 },
    );
  });
});
