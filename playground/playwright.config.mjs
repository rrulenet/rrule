import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser', timeout: 90000, expect: { timeout: 12000 }, fullyParallel: false,
  workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', channel: process.env.PLAYWRIGHT_CHANNEL || undefined, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node scripts/serve.mjs --port 4173', url: 'http://127.0.0.1:4173/rrule/', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop-utc', use: { browserName: 'chromium', timezoneId: 'UTC', viewport: { width: 1440, height: 1100 } } },
    { name: 'desktop-new-york', use: { browserName: 'chromium', timezoneId: 'America/New_York', viewport: { width: 1280, height: 1000 } } },
    { name: 'mobile', use: { browserName: 'chromium', timezoneId: 'Europe/Paris', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
