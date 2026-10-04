import { expect, test, type Page } from '@playwright/test';
import { countNavigations, gotoHydrated, settle, swReady, touchDrag, transition } from './helpers';

/* Phase 12 of the app redesign: view transitions between pages, swipe back, and the per-tab
   stack, scroll and Map state. */

const tabLink = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Sections' }).locator('a.tab', { hasText: name });

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
    () => page.goForward(),
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
  // A colour fade is not motion: on a slow runner WebKit was still fading the /switches tab
  // buttons' background and shadow (200 ms) as the page was revealed (CI run 37188520290).
  // Everything else, the push's own fades first, is opacity alone, 150 ms or less.
  const colour = /^(background|boxShadow|color|borderColor|outlineColor)/;
  const moving = m.animations.filter(
    (a) => !a.props.length || !a.props.every((p) => colour.test(p)),
  );
  expect(moving.length).toBeGreaterThan(0);
  for (const a of moving) {
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
  // motion.ts has re-pointed the tab hrefs once the page settles
  await settle(page, /\/switch\/32$/);
  await expect
    .poll(() => page.evaluate(() => (window.scrollTo(0, 240), Math.round(scrollY))))
    .toBeGreaterThan(0);
  const y = await page.evaluate(() => Math.round(scrollY));

  await tabLink(page, 'Map').click();
  await settle(page, /\/map\?layer=sw/);
  await page.getByRole('group', { name: 'Zoom' }).getByRole('button', { name: 'Zoom in' }).click();
  await expect(page).toHaveURL(/[?&]z=1\.6/);
  const jet = page.getByRole('button', { name: /^Switch 32, Upper Right Jet/ }).first();
  await jet.click();
  await expect(jet).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/[?&]id=switch:32/);

  await tabLink(page, 'Tables').click();
  await expect(page).toHaveURL(/\/switch\/32$/);
  // motion.ts puts the scroll back only when it is more than 1 px off (audit TT2-01)
  await expect
    .poll(() => page.evaluate((y) => Math.abs(Math.round(scrollY) - y), y))
    .toBeLessThanOrEqual(1);

  await tabLink(page, 'Map').click();
  await expect(page).toHaveURL(/[?&]z=1\.6/);
  await expect(page).toHaveURL(/[?&]id=switch:32/);
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

/* On both phone engines (TT3-03); the touches come from helpers' touchDrag (TT3-10). */
test.describe('swipe back', () => {
  test.skip(({ isMobile }) => !isMobile, 'a touch gesture');

  /** One finger along `xs` at `y`. */
  const along = (xs: number[], y: number) => xs.map((x) => [{ x, y }]);

  test('a left-edge drag past 35% returns to the parent', async ({ page }) => {
    await gotoHydrated(page, '/switch/32');
    const w = page.viewportSize()!.width;
    const xs = Array.from({ length: 12 }, (_, i) => 8 + Math.round((i * w * 0.45) / 11));
    await touchDrag(page, along(xs, 400));
    await expect(page).toHaveURL(/\/switches$/);
  });

  test('a short slow drag springs back', async ({ page }) => {
    await page.clock.install();
    await gotoHydrated(page, '/switch/32');
    const navs = await countNavigations(page);
    await touchDrag(page, along([8, 20, 32, 44, 56], 400), { pause: 60 });
    await expect(page.locator('#main')).toHaveCSS('transform', 'none');
    // Past the 300 ms swipe timer, on the fake clock: no navigation was started.
    await page.clock.runFor(350);
    expect(await navs()).toBe(0);
    await expect(page).toHaveURL(/\/switch\/32$/);
  });

  /**
   * Drags in from `x` (inside the 24 px edge) to 45% of the width at `y`; true if the page followed
   * the finger. A page's content starts at the 16 px gutter, so a drag that starts on it uses 20.
   */
  async function follows(page: Page, y: number, x = 8) {
    const w = page.viewportSize()!.width;
    const xs = Array.from({ length: 7 }, (_, i) => x + Math.round((i * w * 0.45) / 6));
    let swiping = false;
    await touchDrag(page, along(xs, y), {
      beforeEnd: async () => {
        swiping = await page.locator('#main').evaluate((el) => el.classList.contains('swiping'));
      },
    });
    return swiping;
  }

  test('a plain edge drag on a handbook page goes back', async ({ page }) => {
    await gotoHydrated(page, '/handbook/tests');
    const parent = await page
      .locator('header.top a.back')
      .evaluate((a) => (a as HTMLAnchorElement).href);
    expect(await follows(page, 400)).toBe(true);
    await expect(page).toHaveURL(parent);
  });

  for (const c of [
    {
      url: '/handbook/tests',
      dialog: 'Contents',
      opener: (page: Page) =>
        page.getByRole('navigation', { name: 'Reader' }).getByRole('button', { name: 'Contents' }),
    },
    {
      url: '/manual/ops/80',
      dialog: 'Go to page',
      opener: (page: Page) =>
        page.getByRole('toolbar', { name: 'Page' }).getByRole('button', { name: /Go to page/ }),
    },
  ]) {
    test(`an edge drag over the open ${c.dialog} sheet stays on ${c.url} (CR2-01)`, async ({
      page,
    }) => {
      await gotoHydrated(page, c.url);
      await c.opener(page).click();
      const dialog = page.getByRole('dialog', { name: c.dialog });
      await expect(dialog).toBeVisible();
      expect(await follows(page, 400)).toBe(false);
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${c.url}$`));
    });
  }

  test('an edge drag on a zoomed manual page pans, not goes back (CR2-01)', async ({ page }) => {
    await gotoHydrated(page, '/manual/wpc/10');
    const scan = page.locator('.sheet.scan');
    await expect(page.locator('.stage img').first()).toBeVisible();
    const fit = (await scan.boundingBox())!.width;
    await page
      .getByRole('group', { name: 'Zoom' })
      .getByRole('button', { name: 'Zoom in' })
      .click();
    await expect.poll(async () => (await scan.boundingBox())!.width).toBeGreaterThan(fit + 1);
    // At the page's left edge too: zoomed, the whole stage is a pan surface.
    const stage = page.locator('.stage.zoomed');
    await stage.evaluate((el) => (el.scrollLeft = 0));
    const b = (await stage.boundingBox())!;
    expect(await follows(page, b.y + b.height / 2, 20)).toBe(false);
    await expect(page).toHaveURL(/\/manual\/wpc\/10$/);
  });

  test('an edge drag on a table scrolled sideways scrolls it back (CR2-01)', async ({ page }) => {
    await gotoHydrated(page, '/handbook/quick');
    const wide = page.locator('.scroll-x').filter({
      has: page.locator('table'),
    });
    const table = await (async () => {
      for (const el of await wide.all())
        if (await el.evaluate((e) => e.scrollWidth > e.clientWidth + 1)) return el;
      throw new Error('no table wider than the screen on /handbook/quick');
    })();
    await table.evaluate((e) => {
      e.scrollIntoView({ block: 'center', behavior: 'instant' });
      e.scrollLeft = 120;
    });
    const b = (await table.boundingBox())!;
    expect(await follows(page, b.y + b.height / 2, 20)).toBe(false);
    await expect(page).toHaveURL(/\/handbook\/quick$/);
  });
});

test('after one online visit all five tabs open offline', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit',
    "offline navigation is an internal error in Playwright's WebKit",
  );
  await gotoHydrated(page, '/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await context.setOffline(true);
  for (const path of ['/', '/map', '/tables', '/handbook', '/workshop']) {
    await gotoHydrated(page, path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await context.setOffline(false);
});
