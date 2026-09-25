import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

/* Phase 12 of the app redesign: view transitions between pages, swipe back, and the per-tab
   stack, scroll and Map state. */

const tabLink = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Sections' }).locator('a.tab', { hasText: name });

interface Motion {
  type: string;
  animations: { name: string; duration: number; props: string[] }[];
  pending?: boolean;
  skipped?: boolean;
}
/* While the worker precaches on a first visit, Chrome skips the cross-document transition (a
   plain swap); the tests that read the transition wait for it, as an installed app has. */
const swReady = (page: Page) =>
  page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

const motion = (page: Page) =>
  page.evaluate(() => (window as unknown as { tafhMotion?: Motion }).tafhMotion ?? null);

/* The transition, once it has run. Under parallel test load Chrome now and then skips a
   cross-document transition altogether (a plain swap, `type: 'none'`; never with one worker);
   the test then steps back and makes the same navigation again. */
async function transition(page: Page, go: () => Promise<void>, to: RegExp, from: RegExp) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await go();
    await expect(page).toHaveURL(to);
    await expect.poll(async () => (await motion(page))?.type).toBeTruthy();
    await expect.poll(async () => (await motion(page))?.pending).toBeFalsy();
    const m = (await motion(page))!;
    if (m.type !== 'none' && !m.skipped) return m;
    await page.goBack();
    await expect(page).toHaveURL(from);
    await expect.poll(async () => (await motion(page))?.type).toBeTruthy();
  }
  throw new Error('Chrome skipped the transition six times over');
}

test('a link push slides the page in; the back link pops it', async ({ page }) => {
  await gotoHydrated(page, '/tables');
  await swReady(page);
  const push = await transition(
    page,
    () => page.locator('main').getByRole('link', { name: 'Switch matrix' }).first().click(),
    /\/switches$/,
    /\/tables$/,
  );
  expect(push.type).toBe('push');
  expect(push.animations.some((a) => a.props.includes('transform') && a.duration === 350)).toBe(
    true,
  );
  const pop = await transition(
    page,
    () => page.locator('header.top a.back').click(),
    /\/tables$/,
    /\/switches$/,
  );
  expect(pop.type).toBe('pop');
});

test('a tab tap cross-fades, whatever the depths', async ({ page }) => {
  await gotoHydrated(page, '/switch/32');
  await swReady(page);
  const m = await transition(page, () => tabLink(page, 'Map').click(), /\/map/, /\/switch\/32$/);
  expect(m.type).toBe('tab');
});

test('under reduced motion a push holds only opacity animations of 150 ms or less', async ({
  browser,
}) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await gotoHydrated(page, '/tables');
  await swReady(page);
  const m = await transition(
    page,
    () => page.locator('main').getByRole('link', { name: 'Switch matrix' }).first().click(),
    /\/switches$/,
    /\/tables$/,
  );
  expect(m.type).toBe('push');
  expect(m.animations.length).toBeGreaterThan(0);
  for (const a of m.animations) {
    expect(a.duration, a.name).toBeLessThanOrEqual(150);
    expect(a.props, a.name).toEqual(['opacity']);
  }
  await context.close();
});

test('each tab keeps its stack, scroll and the Map zoom and selection', async ({ page }) => {
  await gotoHydrated(page, '/map?layer=sw');
  await tabLink(page, 'Tables').click();
  await page.locator('main').getByRole('link', { name: 'Switch matrix' }).first().click();
  await page.locator('main a[data-cell="32"]').first().click();
  await expect(page).toHaveURL(/\/switch\/32$/);
  await expect
    .poll(() => page.evaluate(() => (window.scrollTo(0, 240), Math.round(scrollY))))
    .toBeGreaterThan(0);
  const y = await page.evaluate(() => Math.round(scrollY));

  await tabLink(page, 'Map').click();
  await expect(page).toHaveURL(/\/map\?layer=sw/);
  await page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: 'Zoom in' }).click();
  await expect(page).toHaveURL(/[?&]z=1\.6/);
  const jet = page.getByRole('button', { name: /^Switch 32, Upper Right Jet/ }).first();
  await jet.click();
  await expect(jet).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/[?&]id=32/);

  await tabLink(page, 'Tables').click();
  await expect(page).toHaveURL(/\/switch\/32$/);
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(y);

  await tabLink(page, 'Map').click();
  await expect(page).toHaveURL(/[?&]z=1\.6/);
  await expect(page).toHaveURL(/[?&]id=32/);
  await expect(
    page.getByRole('button', { name: /^Switch 32, Upper Right Jet/ }).first(),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('a view pushed from Diagnose results goes back to Results', async ({ page }) => {
  await gotoHydrated(page, '/');
  await page.getByRole('textbox').first().fill('32');
  await page.locator('article.comp h2 a').first().click();
  await expect(page).toHaveURL(/\/switch\/32$/);
  const back = page.locator('header.top a.back');
  await expect(back).toHaveText('Results');
  await expect(back).toHaveAttribute('href', /\?q=32$/);
});

test.describe('swipe back', () => {
  test.skip(({ isMobile }) => !isMobile, 'a touch gesture');

  async function drag(page: Page, xs: number[], y: number, pause = 0) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: xs[0]!, y }],
    });
    for (const x of xs.slice(1)) {
      if (pause) await page.waitForTimeout(pause);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    }
    if (pause) await page.waitForTimeout(pause);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }

  test('a left-edge drag past 35% returns to the parent', async ({ page }) => {
    await gotoHydrated(page, '/switch/32');
    const w = page.viewportSize()!.width;
    const xs = Array.from({ length: 12 }, (_, i) => 8 + Math.round((i * w * 0.45) / 11));
    await drag(page, xs, 400, 30);
    await expect(page).toHaveURL(/\/switches$/);
  });

  test('a short slow drag springs back', async ({ page }) => {
    await gotoHydrated(page, '/switch/32');
    await drag(page, [8, 20, 32, 44, 56], 400, 60);
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/\/switch\/32$/);
    await expect(page.locator('#main')).toHaveCSS('transform', 'none');
  });
});

test('after one online visit all five tabs open offline', async ({ page, context }) => {
  await gotoHydrated(page, '/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await context.setOffline(true);
  for (const path of ['/', '/map', '/tables', '/handbook', '/workshop']) {
    await gotoHydrated(page, path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await context.setOffline(false);
});
