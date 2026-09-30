import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

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
  await expect(hub(page).getByRole('link', { name: /Solenoids & flashers/ })).toContainText('28');
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
  await expect(page.locator('[data-count="verify"]')).toHaveText('0 of 13');
  await expect(hub(page).getByRole('link', { name: /Machine setup/ })).toContainText('7 steps');
  await expect(hub(page).getByRole('link', { name: /^Care/ })).toContainText(
    'Next: every week or so',
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
  await expect(page.locator('[data-count="verify"]')).toHaveText('1 of 13');
});

test('Appearance stores Light, survives a reload, and System clears it', async ({ page }) => {
  await gotoHydrated(page, '/workshop');
  const seg = page.getByRole('group', { name: 'Toggle theme' });
  await seg.getByRole('button', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(() => localStorage.getItem('tafh:theme'))).toBe('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(seg.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
  await seg.getByRole('button', { name: 'System' }).click();
  expect(await page.evaluate(() => localStorage.getItem('tafh:theme'))).toBeNull();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
});

test('About this handbook opens a dialog and hands focus back', async ({ page }) => {
  await gotoHydrated(page, '/workshop');
  const row = page.getByRole('button', { name: 'About this handbook' });
  await row.click();
  const dialog = page.getByRole('dialog', { name: 'About this handbook' });
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
