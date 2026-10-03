import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

/** Phases 4 and 5 of the app redesign: the navigation shell and the top bar. */

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

  test('the toast sits 10 above the tab bar and covers no tab', async ({ page }) => {
    // Not Home: there the toast clears the Diagnose field above the bar (VP2-02).
    await gotoHydrated(page, '/tables');
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('tafh:toast', { detail: { kind: 'update', text: 'Update ready' } }),
      );
    });
    await expect(page.locator('.toast')).toBeVisible();
    await page
      .locator('.toast')
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const status = await box(page, '.toast');
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
    // The table may still be laying out right after hydration, so keep scrolling until it takes.
    await expect
      .poll(() => page.evaluate(() => (window.scrollTo(0, 600), scrollY)))
      .toBeGreaterThan(0);
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

  test('is 256 wide with sub-rows, the logo and the count pill', async ({ page, browserName }) => {
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
      'Solenoids and flashers',
      'Fuses',
      'LEDs and jumpers',
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
    // 44 since audit AY-12 (spec §6.4): the sub-rows are contiguous, so the target is real height.
    expect((await subs.first().boundingBox())!.height).toBe(44);
    // "Skip to content" stays the first focusable element. WebKit's Tab skips links (Safari's
    // default), so there focus stays on the body.
    if (browserName !== 'webkit') {
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    }
    // No count pill without a Fault; one after.
    const shopping = subs.filter({ hasText: 'Shopping list' });
    await expect(shopping.locator('.cnt')).toHaveCount(0);
    await expect(page.getByRole('status')).toHaveCount(0);
    await gotoHydrated(page, '/switch/32');
    await page.getByRole('button', { name: 'Fault' }).click();
    await expect(nav(page).locator('.subs a', { hasText: 'Shopping list' })).toHaveAccessibleName(
      'Shopping list 1 part to order',
    );
    await expect(page.getByRole('status')).toHaveCount(0);
  });
});

/* Phase 5: the top bar, back links and the large title. */

const BAR = 'header.top';
const headerBox = (page: Page) => box(page, BAR);
const scrollPaddingTop = (page: Page) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop));
const opacity = (page: Page, sel: string) =>
  page.locator(sel).evaluate((el) => parseFloat(getComputedStyle(el).opacity));
/** Gives the page room to scroll so the collapse can be driven. */
const makeTall = (page: Page) =>
  page.evaluate(() => (document.body.style.paddingBottom = '2000px'));
const scrollTo = (page: Page, y: number) =>
  page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }), y);

test.describe('top bar on phones', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of ['/', '/tables', '/handbook', '/workshop']) {
    test(`${path}: the large title is the h1 and collapses over 52 px`, async ({ page }) => {
      await gotoHydrated(page, path);
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toHaveCount(1);
      await expect(page.locator('main > .lt h1')).toBeVisible();
      const compact = page.locator(`${BAR} .ct`);
      await expect(compact).toHaveAttribute('aria-hidden', 'true');
      await expect(compact).toHaveText(await h1.innerText());
      expect(await opacity(page, `${BAR} .ct`)).toBe(0);
      await expect(page.locator(BAR)).not.toHaveAttribute('data-collapsed', /.*/);
      await makeTall(page);
      await scrollTo(page, 46);
      await expect.poll(() => opacity(page, `${BAR} .ct`)).toBeCloseTo(0.5, 1);
      await scrollTo(page, 52);
      await expect.poll(() => opacity(page, `${BAR} .ct`)).toBe(1);
      await expect(page.locator(BAR)).toHaveAttribute('data-collapsed', '');
      await expect.poll(() => opacity(page, 'main > .lt h1')).toBe(0);
      await scrollTo(page, 0);
      await expect.poll(() => opacity(page, `${BAR} .ct`)).toBe(0);
      await expect(page.locator(BAR)).not.toHaveAttribute('data-collapsed', /.*/);
    });
  }

  test('reduced motion swaps the titles at 52 with no fade', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoHydrated(page, '/tables');
    await makeTall(page);
    await scrollTo(page, 48);
    await expect.poll(() => opacity(page, `${BAR} .ct`)).toBe(0);
    await expect.poll(() => opacity(page, 'main > .lt h1')).toBe(1);
    await scrollTo(page, 52);
    await expect.poll(() => opacity(page, `${BAR} .ct`)).toBe(1);
    await expect.poll(() => opacity(page, 'main > .lt h1')).toBe(0);
  });

  test('the bar is 44 tall and the skip link is first and targets #main', async ({
    page,
    browserName,
  }) => {
    await gotoHydrated(page, '/switches');
    const bar = await headerBox(page);
    expect(bar.y).toBe(0);
    expect(bar.height).toBe(44);
    const skip = page.getByRole('link', { name: 'Skip to content' });
    // WebKit's Tab skips links (Safari's default), so there focus stays on the body.
    if (browserName !== 'webkit') {
      await page.keyboard.press('Tab');
      await expect(skip).toBeFocused();
    }
    await expect(skip).toHaveAttribute('href', '#main');
  });

  test('a page with its own h1 keeps it; the bar title is decoration', async ({ page }) => {
    await gotoHydrated(page, '/switches');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator(`${BAR} .ct`)).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator(`${BAR} h1`)).toHaveCount(0);
    await expect(page.locator('main > .lt')).toHaveCount(0);
  });

  for (const [path, parent, label] of [
    ['/switch/32', '/switches', 'Switches'],
    ['/lamp/11', '/lamps', 'Lamps'],
    ['/coil/01', '/coils', 'Solenoids'],
    ['/switches', '/tables', 'Tables'],
    ['/lamps', '/tables', 'Tables'],
    ['/coils', '/tables', 'Tables'],
    ['/fuses', '/tables', 'Tables'],
    ['/handbook/menus', '/handbook', 'Handbook'],
    ['/manual', '/handbook', 'Handbook'],
    ['/parts', '/handbook', 'Handbook'],
    ['/manual/ops/25', '/manual', 'Manuals'],
    ['/shopping', '/workshop', 'Workshop'],
    ['/verify', '/workshop', 'Workshop'],
    ['/setup', '/workshop', 'Workshop'],
    ['/care', '/workshop', 'Workshop'],
  ] as const) {
    test(`${path} has a back link to ${parent}`, async ({ page }) => {
      await gotoHydrated(page, path);
      const back = page.locator(`${BAR} a.back`);
      await expect(back).toHaveCount(1);
      await expect(back).toHaveText(label);
      await expect(back).toHaveAttribute('href', new RegExp(`${parent}$`));
      expect((await back.boundingBox())!.height).toBe(44);
    });
  }

  for (const path of ['/', '/map', '/tables', '/handbook', '/workshop']) {
    test(`${path} has no back link`, async ({ page }) => {
      await gotoHydrated(page, path);
      await expect(page.locator(`${BAR} a.back`)).toHaveCount(0);
    });
  }

  test('component pages and the viewer take the compact title as their h1', async ({ page }) => {
    await gotoHydrated(page, '/switch/32');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Switch 32');
    await expect(page.locator(`${BAR} h1.ct`)).toHaveCount(1);
    await gotoHydrated(page, '/manual/ops/25');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/p\. /);
  });

  test('/map: the h1 reads "Playfield map", shows "Map", and has both bar buttons', async ({
    page,
  }) => {
    await gotoHydrated(page, '/map');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveAccessibleName('Playfield map');
    await expect(h1.locator('.short')).toBeVisible();
    await expect(h1.locator('.short')).toHaveText('Map');
    await expect(page.locator('main > .lt')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Search components' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All components on the map' })).toBeVisible();
    await page.getByRole('button', { name: 'Search components' }).click();
    const dialog = page.getByRole('dialog', { name: 'All components on the map' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('searchbox', { name: 'Search components' })).toBeFocused();
  });

  test('/handbook/menus anchors land below the bar', async ({ page }) => {
    await gotoHydrated(page, '/handbook/menus#p17-2');
    const bar = await headerBox(page);
    await expect
      .poll(() => page.locator('#p17-2').evaluate((el) => el.getBoundingClientRect().top))
      .toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    expect(Math.abs((await scrollPaddingTop(page)) - (bar.height + 12))).toBeLessThanOrEqual(1);
  });
});

test.describe('top bar from 600', () => {
  test('is 50 tall on tablets and 56 on desktops, and carries the title', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await gotoHydrated(page, '/tables');
    expect((await headerBox(page)).height).toBe(50);
    expect(await opacity(page, `${BAR} .ct`)).toBe(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tables');
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, '/tables');
    expect((await headerBox(page)).height).toBe(56);
    expect(await opacity(page, `${BAR} .ct`)).toBe(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tables');
  });

  test('/map at 1440: "Search components" focuses the panel field; no "All components" button', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, '/map');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Playfield map');
    await expect(page.locator('header.top h1 .short')).toBeHidden();
    await expect(page.getByRole('button', { name: 'All components on the map' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Search components' }).click();
    await expect(
      page.getByRole('complementary').getByRole('searchbox', { name: 'Search components' }),
    ).toBeFocused();
  });

  test('/handbook/menus anchors land below the bar at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, '/handbook/menus#p17-2');
    const bar = await headerBox(page);
    await expect
      .poll(() => page.locator('#p17-2').evaluate((el) => el.getBoundingClientRect().top))
      .toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    expect(Math.abs((await scrollPaddingTop(page)) - (bar.height + 12))).toBeLessThanOrEqual(1);
  });
});

/* P3 item 1 of the app audit (spec §13): one name per page, and every page says what it is. */
test.describe('page names and descriptions', () => {
  const DEFAULT = 'Offline service companion for The Addams Family pinball.';
  const description = (html: string) =>
    /<meta name="description" content="([^"]*)"/.exec(html)?.[1];

  test('a page is titled by its name', async ({ page }) => {
    await gotoHydrated(page, '/switches');
    await expect(page).toHaveTitle('Switch matrix · The Addams Family Handbook');
    await gotoHydrated(page, '/coils');
    await expect(page).toHaveTitle('Solenoids and flashers · The Addams Family Handbook');
  });

  test('every route has a description of its own', async ({ request }) => {
    // One sample per route file in src/pages; data/handbook.json.ts is a JSON endpoint.
    const routes = [
      '',
      'map',
      'switches',
      'lamps',
      'coils',
      'fuses',
      'tables',
      'parts',
      'handbook',
      'handbook/tests',
      'handbook/appendix',
      'manual',
      'manual/ops/25',
      'switch/32',
      'lamp/11',
      'coil/01',
      'shopping',
      'verify',
      'care',
      'setup',
      'workshop',
    ];
    const seen = new Map<string, string>();
    for (const route of routes) {
      const d = description(await (await request.get(route)).text());
      expect(d, route).toBeTruthy();
      expect(d, route).not.toBe(DEFAULT);
      expect(seen.get(d!), `${route} repeats ${seen.get(d!)}`).toBeUndefined();
      seen.set(d!, route);
    }
    // The 404 page alone keeps the site's default.
    expect(description(await (await request.get('no-such-page')).text())).toBe(DEFAULT);
  });
});
