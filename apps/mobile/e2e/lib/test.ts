import { test as base } from '@playwright/test';

// Extended `test` that forwards browser console errors + uncaught page errors to
// the Playwright stdout. When a flow fails because the app itself errored (e.g. a
// Firebase/emulator connection problem or a converter throw), the reason shows up
// directly in the CI log instead of only inside the trace artifact.
export const test = base.extend({
  page: async ({ page }, use) => {
    page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`);
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
