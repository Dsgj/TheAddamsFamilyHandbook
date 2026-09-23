import { defineConfig, devices } from '@playwright/test';

const base = process.env.BASE_PATH ?? '/';
const port = 4321;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${port}${base.endsWith('/') ? base : base + '/'}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone-dark', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
    {
      name: 'desktop-light',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: `pnpm preview --port ${port}`,
    url: `http://localhost:${port}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
