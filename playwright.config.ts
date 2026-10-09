import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/congressionalappchallenge/`,
    trace: 'retain-on-failure',
  },
  // Test the production build, because the service worker only exists there.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/congressionalappchallenge/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    // Pixel 5-sized viewport: our target is a small Android phone.
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
});
