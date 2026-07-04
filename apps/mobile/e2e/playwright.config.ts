import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

// The Expo web export lives in apps/mobile/dist; the web-e2e CI job builds it
// (with USE_FIREBASE_EMULATOR=1) before Playwright runs. The tiny serve.mjs
// static server falls back to index.html so expo-router client routing + deep
// links (/event/<id>) resolve — and keeps this dependency-free (no `serve`).
const mobileDir = path.join(__dirname, '..');
const PORT = Number(process.env.E2E_WEB_PORT ?? 5050);

export default defineConfig({
  testDir: './flows',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node e2e/serve.mjs dist ${PORT}`,
    cwd: mobileDir,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
