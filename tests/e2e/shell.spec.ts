import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

/** Phase 4 of the app redesign: the navigation shell (tab bar, rail, sidebar). */

const TAB_ORDER = ['Diagnose', 'Map', 'Tables', 'Handbook', 'Workshop'];
const nav = (page: Page) => page.getByRole('navigation', { name: 'Sections' });
const tabs = (page: Page) => nav(page).locator('a.tab');

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, `${selector} is visible`).not.toBeNull();
  return b!;
}

test.describe('phone tab bar', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('five tabs in job order, each at least 44 tall, on a 49 px bar at the bottom', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    await expect(tabs(page)).toHaveText(TAB_ORDER);
    for (let i = 0; i < TAB_ORDER.length; i++) {
      const b = await tabs(page).nth(i).boundingBox();
      expect(b!.height).toBeGreaterThanOrEqual(44);
    }
    const bar = await box(page, 'nav.shell');
    expect(bar.width).toBe(390);
    expect(bar.height).toBe(49);
    expect(bar.y + bar.height).toBe(844);
    // Only the tab bar's form shows: no sub-rows, no sidebar logo.
    await expect(nav(page).locator('.subs a:visible')).toHaveCount(0);
    await expect(nav(page).locator('.shell-logo')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  for (const [path, current] of [
    ['/', 'Diagnose'],
    ['/map', 'Map'],
    ['/switch/32', 'Tables'],
    ['/fuses', 'Tables'],
    ['/shopping', 'Workshop'],
    ['/manual/ops/25', 'Handbook'],
    ['/parts', 'Handbook'],
  ] as const) {
    test(`${path} marks ${current} current`, async ({ page }) => {
      await gotoHydrated(page, path);
      const cur = tabs(page).and(page.locator('[aria-current="page"]'));
      await expect(cur).toHaveCount(1);
      await expect(cur).toHaveText(current);
    });
  }

  test('the Workshop badge names the shopping-list count, live and after navigating', async ({
    page,
  }) => {
    await gotoHydrated(page, '/switch/32');
    const workshop = tabs(page).filter({ hasText: 'Workshop' });
    await expect(workshop).toHaveAccessibleName('Workshop');
    await expect(workshop.locator('.badge')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fault' }).click();
    await expect(workshop).toHaveAccessibleName('Workshop, 1 on the shopping list');
    await expect(workshop.locator('.badge')).toHaveText('1');
    await expect(workshop.locator('.badge')).toHaveAttribute('aria-hidden', 'true');
    await gotoHydrated(page, '/tables');
    await expect(tabs(page).filter({ hasText: 'Workshop' })).toHaveAccessibleName(
      'Workshop, 1 on the shopping list',
    );
  });

  test('the last row of /parts scrolls clear of the tab bar', async ({ page }) => {
    await gotoHydrated(page, '/parts');
    const last = page.locator('table.t tbody tr').last();
    await last.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const row = await last.boundingBox();
    const bar = await box(page, 'nav.shell');
    expect(row!.y + row!.height).toBeLessThanOrEqual(bar.y + 0.5);
  });

  test('#sw-status sits 10 above the tab bar and covers no tab', async ({ page }) => {
    await gotoHydrated(page, '/');
    await page.evaluate(() => {
      const s = document.getElementById('sw-status')!;
      s.textContent = 'Update ready';
      s.hidden = false;
    });
    const status = await box(page, '#sw-status');
    const bar = await box(page, 'nav.shell');
    expect(Math.abs(bar.y - (status.y + status.height) - 10)).toBeLessThanOrEqual(0.5);
    for (let i = 0; i < TAB_ORDER.length; i++) {
      const t = (await tabs(page).nth(i).boundingBox())!;
      expect(t.y).toBeGreaterThanOrEqual(status.y + status.height);
    }
  });

  test('reselecting the current tab scrolls to the top and focuses the h1; from a pushed page it goes to the root', async ({
    page,
  }) => {
    await gotoHydrated(page, '/parts');
    await page.evaluate(() => window.scrollTo(0, 600));
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    await tabs(page).filter({ hasText: 'Handbook' }).click();
    await expect(page).toHaveURL(/\/handbook$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('load'); // the reselect handler is wired at the end of body
    // On the root itself: no navigation, back to the top, the h1 holds focus.
    await page.evaluate(() => window.scrollTo(0, 400));
    await tabs(page).filter({ hasText: 'Handbook' }).click();
    await expect(page).toHaveURL(/\/handbook$/);
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  });
});

test.describe('rail', () => {
  for (const size of [
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
  ]) {
    test(`at ${size.width}×${size.height} the rail is 80 wide and there is no tab bar`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await gotoHydrated(page, '/tables');
      const rail = await box(page, 'nav.shell');
      expect(rail.x).toBe(0);
      expect(rail.width).toBe(80);
      expect(rail.height).toBe(size.height);
      await expect(tabs(page)).toHaveText(TAB_ORDER);
      await expect(tabs(page).and(page.locator('[aria-current="page"]'))).toHaveText('Tables');
      await expect(nav(page).locator('.subs a:visible')).toHaveCount(0);
      // The content starts to the right of the rail; the tab bar variable is 0.
      const main = await box(page, 'main');
      expect(main.x).toBeGreaterThanOrEqual(80);
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h').trim(),
        ),
      ).toBe('0px');
    });
  }
});

test.describe('sidebar', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('is 256 wide with sub-rows, the logo and the count pill', async ({ page }) => {
    await gotoHydrated(page, '/lamps');
    const side = await box(page, 'nav.shell');
    expect(side.x).toBe(0);
    expect(side.width).toBe(256);
    expect(side.height).toBe(900);
    await expect(nav(page).locator('.shell-logo img')).toBeVisible();
    await expect(tabs(page)).toHaveText(TAB_ORDER);
    await expect(tabs(page).and(page.locator('[aria-current="page"]'))).toHaveText('Tables');
    const subs = nav(page).locator('.subs a');
    await expect(subs).toHaveText([
      'Switch matrix',
      'Lamp matrix',
      'Solenoids & flashers',
      'Fuses',
      'LEDs & jumpers',
      'Handbook',
      'Manuals',
      'Parts',
      'Shopping list',
      'Verify',
      'Care',
      'Machine setup',
      'Device data',
    ]);
    await expect(subs.and(page.locator('[aria-current="page"]'))).toHaveText('Lamp matrix');
    for (let i = 0; i < TAB_ORDER.length; i++) {
      expect((await tabs(page).nth(i).boundingBox())!.height).toBe(44);
    }
    expect((await subs.first().boundingBox())!.height).toBe(36);
    // "Skip to content" stays the first focusable element.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    // No count pill without a Fault; one after.
    const shopping = subs.filter({ hasText: 'Shopping list' });
    await expect(shopping.locator('.cnt')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveCount(0);
    await gotoHydrated(page, '/switch/32');
    await page.getByRole('button', { name: 'Fault' }).click();
    await expect(nav(page).locator('.subs a', { hasText: 'Shopping list' })).toHaveAccessibleName(
      'Shopping list 1 parts to order',
    );
    await expect(page.getByRole('status')).toHaveCount(0);
  });
});
