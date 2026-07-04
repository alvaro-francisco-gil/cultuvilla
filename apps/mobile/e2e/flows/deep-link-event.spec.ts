import { test, expect } from '../lib/test';
import { fixtures } from '../lib/fixtures';

// Read-only smoke: deep-linking straight into an event detail (anonymous)
// renders the seeded event. Proves the whole substrate boots end to end —
// web export + emulator + seed + static serve + client emulator-connect —
// before any interaction, so a failure here localises setup problems fast.
test('deep-link into an event renders it for an anonymous visitor', async ({ page }) => {
  await page.goto(`/event/${fixtures.event.docId}`);
  await expect(page.getByText(fixtures.event.title)).toBeVisible({ timeout: 30_000 });
  // Anonymous visitor gets the guest sign-up CTA.
  await expect(page.getByText('Apuntarme')).toBeVisible();
});
