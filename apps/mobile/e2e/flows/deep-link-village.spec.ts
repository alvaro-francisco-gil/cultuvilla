import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';

// A shared or searched village link must keep its own URL on web. The native
// cold-entry redirect into the tab shell once ran here too, rewriting every
// `/<pueblo>` into `/mi-pueblo?villageId=<doc id>` in front of the visitor and
// the crawler — which undoes the point of having the pueblo in the URL.
test('a cold visit to a village keeps /<pueblo> in the address bar', async ({ page }) => {
  await page.goto(`/${fixtures.village.slug}`);
  await expect(page.getByText(fixtures.village.name).first()).toBeVisible({ timeout: 30_000 });

  expect(new URL(page.url()).pathname).toBe(`/${fixtures.village.slug}`);
});
