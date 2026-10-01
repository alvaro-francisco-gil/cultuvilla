import { test, expect } from '../lib/test';
import { APP_STORES } from '@cultuvilla/shared/config';

// /descarga is printed on a QR that is never reprinted, so this runs the real
// web export: a phone must land on its store with no picker in between, and a
// desktop must still get the picker. The store hosts are stubbed — the test
// proves the browser navigated there, not that Apple/Google are up.

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

test.beforeEach(async ({ context }) => {
  await context.route(/^https:\/\/(apps\.apple\.com|play\.google\.com)\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>store stub</title>' }),
  );
});

test.describe('on an iPhone', () => {
  test.use({ userAgent: IPHONE, isMobile: true, hasTouch: true });

  test('goes straight to the App Store', async ({ page }) => {
    await page.goto('/descarga');
    await page.waitForURL(APP_STORES.ios, { timeout: 30_000 });
  });
});

test.describe('on an Android phone', () => {
  test.use({ userAgent: ANDROID, isMobile: true, hasTouch: true });

  test('goes straight to Google Play', async ({ page }) => {
    await page.goto('/descarga');
    await page.waitForURL(APP_STORES.android, { timeout: 30_000 });
  });
});

test('desktop stays on the store picker', async ({ page }) => {
  await page.goto('/descarga');
  await expect(page.getByText('Descargar en el App Store')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Descargar en Google Play')).toBeVisible();
  await expect(page.getByText('Seguir en la web')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/descarga');
});
