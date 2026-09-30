import { test, expect } from '../lib/test';

// The "get the app" bar is decided entirely from `navigator.userAgent`, and its
// unit test (components/__tests__/SmartAppBanner.test.tsx) already pins that
// decision. What no test covered until now is the step that actually failed in
// the field: whether the bar SURVIVES INTO THE REAL PAGE — mounted in the root
// layout above the navigator, in the exported web bundle, in a browser.
//
// That gap is not academic. On iOS Safari the bar is drawn by Apple from the
// `apple-itunes-app` meta tag, not by us, so Safari looks correct even if our
// component never renders. Every other iOS browser — Chrome, Firefox, and the
// in-app webviews that most shared village links open in — has only our bar.
// A regression here is therefore INVISIBLE in the browser people test with and
// visible in the ones real visitors arrive through.
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

test.describe('store banner on the web build', () => {
  test.describe('iPhone Chrome', () => {
    test.use({ userAgent: IPHONE_CHROME });

    test('offers the App Store, since Apple draws no bar here', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('smart-app-banner')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('smart-app-banner-cta')).toBeVisible();
    });
  });

  test.describe('iPhone Safari', () => {
    test.use({ userAgent: IPHONE_SAFARI });

    // Safari renders its own bar from the meta tag; ours would be a second bar
    // saying the same thing, so it must stand down.
    test('stands down for Apple’s native smart app banner', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('smart-app-banner')).toHaveCount(0, { timeout: 30_000 });
    });
  });

  test.describe('desktop', () => {
    test.use({ userAgent: DESKTOP });

    // The banner is an offer; the safe failure is silence, never sending a
    // Windows visitor to the App Store.
    test('offers nothing', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('smart-app-banner')).toHaveCount(0, { timeout: 30_000 });
    });
  });
});
