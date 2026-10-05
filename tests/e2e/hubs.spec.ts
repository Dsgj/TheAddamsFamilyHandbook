import { expect, test, type Page } from '@playwright/test';
import { activate, gotoHydrated } from './helpers';

/** Phase 3 of the app redesign: the Tables and Workshop hubs, the list vocabulary, Appearance. */

const ROWS = 'ul.lst > li > :is(a, button).lrow';

async function rowsAreTall(page: Page) {
  const rows = page.locator(ROWS);
  const n = await rows.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const box = await rows.nth(i).boundingBox();
    expect(box, `row ${i} visible`).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  // Everything else in a list is a labelled static row, never a bare element.
  const other = page.locator('ul.lst > li > :not(a):not(button)');
  for (let i = 0; i < (await other.count()); i++) {
    await expect(other.nth(i)).toHaveClass(/\bstatic\b/);
  }
}

const hub = (page: Page) => page.locator('.hub');
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test('Tables: rows, counts from the data and the search filter', async ({ page }) => {
  await gotoHydrated(page, '/tables');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tables');
  await rowsAreTall(page);
  expect(await page.locator(ROWS).count()).toBeGreaterThanOrEqual(8);
  await expect(hub(page).getByRole('link', { name: /Switch matrix/ })).toContainText(
    '64 matrix, 8 dedicated, 8 flipper',
  );
  await expect(hub(page).getByRole('link', { name: /Solenoids and flashers/ })).toContainText('28');
  await expect(hub(page).getByRole('link', { name: /^Fuses/ })).toContainText('25');
  await expect(page.locator('[data-recent]')).toBeHidden();
  await page.getByRole('searchbox', { name: 'Search tables' }).fill('lamp');
  const visible = page.locator(`${ROWS}:visible`);
  await expect(visible).toHaveCount(1);
  await expect(visible).toContainText('Lamp matrix');
  await page.getByRole('searchbox', { name: 'Search tables' }).fill('zzz');
  await expect(page.locator(`${ROWS}:visible`)).toHaveCount(0);
  await expect(page.getByText('No tables match “zzz”.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('Workshop: rows and counts from the device', async ({ page }) => {
  await gotoHydrated(page, '/workshop');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Workshop');
  await rowsAreTall(page);
  await expect(page.locator('[data-count="shopping"]')).toHaveText('');
  await expect(page.locator('[data-count="verify"]')).toHaveText('0 of 16');
  await expect(hub(page).getByRole('link', { name: /Machine setup/ })).toContainText(
    '47 settings in 7 steps',
  );
  await expect(hub(page).getByRole('link', { name: /^Verify/ })).toContainText(
    '16 data points to check on the machine',
  );
  await expect(hub(page).getByRole('link', { name: /^Care/ })).toContainText(
    'Every week to every year',
  );
  await expect(page.locator('.lrow.static', { hasText: 'Version' }).locator('.val')).toHaveText(
    '0.1.0',
  );
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await noHorizontalScroll(page)).toBe(true);

  // A Fault on switch 32 shows on the Shopping list row.
  await gotoHydrated(page, '/switch/32');
  await page.getByRole('button', { name: 'Fault' }).click();
  await gotoHydrated(page, '/workshop');
  await expect(page.locator('[data-count="shopping"]')).toHaveText('1');

  // One tick on Verify shows on the Verify row.
  await gotoHydrated(page, '/verify');
  await page.locator('input.verify-check').first().check();
  await gotoHydrated(page, '/workshop');
  await expect(page.locator('[data-count="verify"]')).toHaveText('1 of 16');
});

test('Appearance stores Light, survives a reload, and System clears it', async ({ page }) => {
  // The browser's bar follows the choice (audit DS2-01): both theme-color metas, whatever the
  // system's scheme, until System gives each its own colour back.
  const bar = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
        (m) => m.content,
      ),
    );
  await gotoHydrated(page, '/workshop');
  const own = await bar();
  expect(own).toEqual(['#0E0B10', '#EFE9DA']);
  const seg = page.getByRole('group', { name: 'Toggle theme' });
  await seg.getByRole('button', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await bar()).toEqual(['#EFE9DA', '#EFE9DA']);
  expect(await page.evaluate(() => localStorage.getItem('tafh:theme'))).toBe('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await bar()).toEqual(['#EFE9DA', '#EFE9DA']);
  await expect(seg.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
  await seg.getByRole('button', { name: 'Dark' }).click();
  expect(await bar()).toEqual(['#0E0B10', '#0E0B10']);
  await seg.getByRole('button', { name: 'System' }).click();
  expect(await page.evaluate(() => localStorage.getItem('tafh:theme'))).toBeNull();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  expect(await bar()).toEqual(own);
});

test('About the app opens a dialog and hands focus back', async ({ page, browserName }) => {
  await gotoHydrated(page, '/workshop');
  const row = page.getByRole('button', { name: 'About the app' });
  await activate(row, browserName);
  const dialog = page.getByRole('dialog', { name: 'About the app' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Williams Electronics Games / Midway');
  await expect(dialog).toContainText('Version 0.1.0');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
});

test('the interim nav reaches both hubs and the theme button is gone', async ({ page }) => {
  await gotoHydrated(page, '/');
  const nav = page.getByRole('navigation', { name: 'Sections' });
  await expect(nav.getByRole('link', { name: 'Tables' })).toHaveAttribute('href', /tables/);
  await expect(nav.getByRole('link', { name: 'Workshop' })).toHaveAttribute('href', /workshop/);
  await expect(page.locator('#theme-toggle')).toHaveCount(0);
});

/* Audit P2 item 12, VL3-13: the sidebar's rows under Tables are the hub's rows, by name and target
   ("LEDs and jumpers" matched no row on the hub). */
test('the sidebar rows under Tables each match a Tables hub row', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the sidebar shows from 1280');
  await gotoHydrated(page, '/tables');
  const hub = await page
    .locator('ul.lst > li > a.lrow')
    .evaluateAll((as) =>
      as.map((a) => `${a.querySelector('.ttl')?.textContent?.trim()} ${a.getAttribute('href')}`),
    );
  const subs = await page
    .locator('nav.shell li:has(> a.tab[data-tab="tables"]) a.sub')
    .evaluateAll((as) =>
      as.map((a) => `${a.querySelector('.lbl')?.textContent?.trim()} ${a.getAttribute('href')}`),
    );
  expect(subs.length).toBeGreaterThan(3);
  for (const s of subs) expect(hub, s).toContain(s);
});
