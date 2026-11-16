import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/**
 * E2E tests run against the production build (`vite preview`), with the CSP
 * exactly as deployed. A dummy support URL is configured so the link can be tested – it is
 * never requested.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    acceptDownloads: true,
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_BUYMEACOFFEE_URL: 'https://www.buymeacoffee.com/example' },
  },
});
