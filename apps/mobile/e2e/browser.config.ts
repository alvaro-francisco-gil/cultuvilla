import { defineConfig, devices } from '@playwright/test';

// Standalone real-browser config for pure DOM-behaviour tests that don't need
// the Expo web export or the Firebase emulators (unlike flows/, which do). Tests
// build their own page with `page.setContent`, so there is no webServer here.
// Desktop Chrome gives us `(hover: hover) and (pointer: fine)` + a real
// `requestAnimationFrame`, which is exactly the environment where the scroll
// arrows live — and the only place "Illegal invocation" reproduces.
export default defineConfig({
  testDir: './browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
