import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const base = process.env.BASE_PATH ?? '/';
const port = 4321;
const host = 'localhost';

// Playwright starts the webServer before global-setup, and `astro preview` without a build dies
// with an assertion, so a missing build is caught here with its message.
if (!existsSync('dist/sw.js')) throw new Error('no dist/sw.js: run pnpm build first');

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI keeps a report to download and a JSON one that scripts/flaky.mjs lists the retried tests
  // from into the job summary (audit TT2-04).
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        ['json', { outputFile: 'test-results/report.json' }],
      ]
    : 'list',
  // A reused server must serve this dist/ (TT-08); see tests/e2e/global-setup.ts.
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://${host}:${port}${base.endsWith('/') ? base : base + '/'}`,
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
    {
      // The owner's phone (TT-05): an iPhone in WebKit at its installed (standalone) size.
      name: 'phone-webkit',
      use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
    },
    // The GitHub Pages build (audit TT2-03): with a BASE_PATH only, the tests tagged @subpath,
    // whose paths are relative to baseURL. CI runs it in the pages job, on the build that ships.
    ...(base === '/'
      ? []
      : [
          {
            name: 'subpath',
            grep: /@subpath/,
            use: { ...devices['Pixel 7'], colorScheme: 'dark' as const },
          },
        ]),
  ],
  webServer: {
    // --ignore-lock: a live `pnpm preview` started by hand holds Astro's .astro/preview.json lock,
    // which would make this preview refuse to start (a lock whose pid is dead is cleared by Astro).
    // It also keeps preview in the foreground when Astro detects an agent (auto-backgrounding is
    // off only on Windows), so Playwright owns the process.
    command: `pnpm preview --port ${port} --ignore-lock`,
    url: `http://${host}:${port}${base}`,
    // Locally a server already on the port is reused once global-setup has checked its build.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
