import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

/** P2 item 2 of the app audit: the shared button, the search field, the wire swatch and the toast
    stacking (spec §8.6, §8.7, §8.8, §4 "Stacking"). */

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, `${selector} is visible`).not.toBeNull();
  return b!;
}

async function showToast(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('tafh:toast', { detail: { kind: 'update', text: 'Update ready' } }),
    );
  });
  await expect(page.locator('.toast')).toBeVisible();
  await page
    .locator('.toast')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

/** The toast sits 10 above what it clears, give or take the rounding of a measured lift. */
function expectGap(gap: number, what: string) {
  expect(gap, what).toBeGreaterThanOrEqual(9.5);
  expect(gap, what).toBeLessThanOrEqual(11);
}

test('a lone .btn.sm keeps a 44 hit area: 3 px above and below it still hits the button', async ({
  page,
}) => {
  await gotoHydrated(page, '/switch/32');
  const pager = page.getByRole('navigation', { name: 'Previous and next' });
  const btn = pager.locator('a.btn.sm').first();
  await expect(btn).toBeVisible();
  const hits = await btn.evaluate((el) => {
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const hit = (y: number) => {
      const at = document.elementFromPoint(cx, y);
      return !!at && (at === el || el.contains(at));
    };
    return { height: r.height, above: hit(r.top - 3), below: hit(r.bottom + 3) };
  });
  expect(hits.height).toBeGreaterThanOrEqual(36);
  expect(hits.above, 'the point 3 px above the button').toBe(true);
  expect(hits.below, 'the point 3 px below the button').toBe(true);
});

test('a bare .btn is 50 tall with a 12 radius: "Go" in the Go to page sheet', async ({ page }) => {
  await gotoHydrated(page, '/manual/ops/25');
  await page
    .getByRole('toolbar', { name: 'Page' })
    .getByRole('button', { name: /Go to page/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Go to page' });
  const go = dialog.getByRole('button', { name: 'Go' });
  await expect(go).toBeVisible();
  // Measured once the sheet has risen: mid-rise its translateY leaves the height a hair short.
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  );
  const s = await go.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { height: el.getBoundingClientRect().height, radius: cs.borderTopLeftRadius };
  });
  expect(Math.round(s.height)).toBe(50);
  expect(s.radius).toBe('12px');
});

test('the /tables search is 16 px text in a 44 tall box, so iOS does not zoom', async ({
  page,
}) => {
  await gotoHydrated(page, '/tables');
  const field = page.getByRole('searchbox', { name: 'Search tables' });
  await expect(field).toBeVisible();
  const s = await field.evaluate((el) => ({
    size: parseFloat(getComputedStyle(el).fontSize),
    height: el.getBoundingClientRect().height,
  }));
  expect(s.size).toBeGreaterThanOrEqual(16);
  expect(s.height).toBeGreaterThanOrEqual(44);
});

test.describe('the toast clears the bottom chrome', () => {
  // The toast host reads --toast-lift, set by the reader toolbar and the map sheet.
  test('on a handbook section it sits above the reader toolbar', async ({ page }) => {
    await gotoHydrated(page, '/handbook/menus');
    await expect(page.getByRole('navigation', { name: 'Reader' })).toBeVisible();
    await showToast(page);
    const toast = await box(page, '.toast');
    const bar = await box(page, 'nav.rbar');
    expect(toast.y + toast.height).toBeLessThanOrEqual(bar.y + 0.5);
  });

  test('on the phone map it sits above the peeking sheet', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the map sheet is phone only');
    await gotoHydrated(page, '/map?layer=sw&id=32');
    const sheet = 'section.sheet[aria-label^="Selected component"]';
    await expect(page.locator(sheet)).toHaveAttribute('data-id', '32');
    await showToast(page);
    const toast = await box(page, '.toast');
    const top = await box(page, sheet);
    expect(toast.y + toast.height).toBeLessThanOrEqual(top.y + 0.5);
  });

  test('on the phone map it stays 10 above the sheet with a home-indicator inset', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the map sheet is phone only');
    // The emulator has no safe area, so give it an iPhone's 34. The sheet pads its body with
    // safe-bot and so grows by it; the toast's lift must carry it too, at both detents.
    await gotoHydrated(page, '/map?layer=sw&id=32');
    await page.addStyleTag({ content: ':root { --safe-bot: 34px !important; }' });
    const sheet = page.locator('section.sheet[aria-label^="Selected component"]');
    await expect(sheet).toHaveAttribute('data-id', '32');
    await showToast(page);
    const gap = async () => {
      await sheet.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
      const toast = await box(page, '.toast');
      const top = await box(page, 'section.sheet[aria-label^="Selected component"]');
      return top.y - (toast.y + toast.height);
    };
    expectGap(await gap(), 'peek');
    await sheet.getByRole('button', { name: 'Expand details' }).click();
    expectGap(await gap(), 'expanded');
  });

  test('on Diagnose it clears the sticky dock, and stays down when the dock sits higher', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the bottom dock is below 1000 (spec §9.1)');
    const bottom = (b: { y: number; height: number }) => b.y + b.height;
    // Long results: the dock sticks above the tab bar, and the toast rises to 10 above it.
    await gotoHydrated(page, '/?q=32');
    await expect(page.locator('.diag')).toHaveAttribute('data-mode', 'results');
    await showToast(page);
    const stuck = await box(page, '.dock');
    expectGap(stuck.y - bottom(await box(page, '.toast')), 'toast above the stuck dock');
    // Scrolled to the end, the dock sits higher than the toast's usual place, 10 above the tab bar
    // (where the stuck dock ended): the toast drops back there and still misses the dock.
    const bar = bottom(stuck);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect
      .poll(async () => bar - bottom(await box(page, '.toast')), { message: 'toast at rest' })
      .toBeCloseTo(10, 0);
    const dock = await box(page, '.dock');
    const toast = await box(page, '.toast');
    expect(bottom(dock), 'the dock sits higher').toBeLessThan(bar - 1);
    expect(toast.y >= bottom(dock) || bottom(toast) <= dock.y, 'toast and dock apart').toBe(true);
    // A search with no hits: the dock follows the short page, so the toast is not lifted at all.
    await gotoHydrated(page, '/?q=zzqx');
    await expect(page.locator('.diag')).toHaveAttribute('data-mode', 'search');
    await showToast(page);
    const lift = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--toast-lift'),
    );
    expect(lift).toBe('');
  });

  test('on phone Home it clears the field and its buttons at the foot (VP2-02)', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'the field ends Home below 1000 (spec §9.1)');
    await gotoHydrated(page, '/');
    await expect(page.locator('.diag')).toHaveAttribute('data-mode', 'home');
    await showToast(page);
    const dock = await box(page, '.dock');
    const toast = await box(page, '.toast');
    expectGap(dock.y - (toast.y + toast.height), 'toast above the field');
  });

  test('on desktop Diagnose the field sits above the results and the toast is not lifted', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'from 1000 the field is at the top of the column (spec §9.1)');
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, '/?q=32');
    await expect(page.locator('.diag')).toHaveAttribute('data-mode', 'results');
    const dock = page.locator('.diag .dock');
    expect(await dock.evaluate((el) => getComputedStyle(el).position)).toBe('static');
    const field = await box(page, '.diag .dock');
    const first = await box(page, '.diag article.card');
    expect(field.y + field.height, 'the field above the results').toBeLessThanOrEqual(first.y);
    await showToast(page);
    const lift = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--toast-lift'),
    );
    expect(lift).toBe('');
  });
});

/* The islands: every field is 16 px text (iOS zooms into anything smaller), and every search field
   is the one shared pattern, a .search input in a .srch wrapper with a Clear search button. */
const ROUTES = [
  '/',
  '/tables',
  '/handbook',
  '/handbook/menus',
  '/manual',
  '/parts',
  '/map',
  '/setup',
  '/shopping',
  '/workshop',
  '/switches',
];
const FIELDS =
  'input:not([type=checkbox],[type=radio],[type=range],[type=file],[type=hidden]), select, textarea';

test.describe('every field is 16 px text', () => {
  for (const path of ROUTES) {
    test(`on ${path}`, async ({ page }) => {
      if (path === '/shopping') {
        // One part on the list, so the readonly text box can be shown and measured.
        await gotoHydrated(page, '/switch/32');
        await page.getByRole('button', { name: 'Fault' }).click();
      }
      await gotoHydrated(page, path);
      if (path === '/shopping') {
        await page.getByRole('button', { name: 'Show text' }).click();
        await expect(page.locator('textarea')).toBeVisible();
      }
      const small = await page.locator(FIELDS).evaluateAll((els) =>
        els
          .filter((el) => el.checkVisibility({ visibilityProperty: true }))
          .map((el) => ({
            field: el.getAttribute('aria-label') || el.id || el.className,
            size: parseFloat(getComputedStyle(el).fontSize),
          }))
          .filter((f) => f.size < 16),
      );
      expect(small).toEqual([]);
    });
  }
});

// Routes whose search field shows at every width.
const SEARCHED = ['/tables', '/handbook', '/manual', '/parts'];

test.describe('every search field is the shared .srch pattern', () => {
  for (const path of ROUTES) {
    test(`on ${path}`, async ({ page }) => {
      await gotoHydrated(page, path);
      let checked = 0;
      // Hidden fields are skipped: the phone map field sits in a closed sheet.
      for (const field of await page.locator('input[type=search]').all()) {
        if (!(await field.isVisible())) continue;
        checked++;
        const s = await field.evaluate((el) => ({
          search: el.classList.contains('search'),
          srch: !!el.parentElement?.classList.contains('srch'),
          height: el.getBoundingClientRect().height,
        }));
        expect(s).toMatchObject({ search: true, srch: true });
        expect(s.height).toBeGreaterThanOrEqual(44);
        const clear = field.locator('xpath=..').getByRole('button', { name: 'Clear search' });
        await expect(clear).toBeHidden();
        await field.fill('zzz');
        await expect(clear).toBeVisible();
        await clear.click();
        await expect(field).toHaveValue('');
        await expect(field).toBeFocused();
        await expect(clear).toBeHidden();
      }
      if (SEARCHED.includes(path)) expect(checked).toBeGreaterThan(0);
    });
  }
});

test('a wire colour is a plain .wire swatch, not a tappable-looking chip', async ({ page }) => {
  await gotoHydrated(page, '/switch/32');
  const wires = page.locator('main .wire');
  expect(await wires.count()).toBeGreaterThan(0);
  await expect(page.locator('.wire.chip')).toHaveCount(0);
  const s = await wires.first().evaluate((el) => ({
    cursor: getComputedStyle(el).cursor,
    height: el.getBoundingClientRect().height,
  }));
  expect(s.cursor).toBe('auto');
  expect(s.height).toBeLessThan(32);
});

test('a wire swatch keeps an edge as strong as the 1 px border it replaced', async ({ page }) => {
  // A white wire on the light page needs the dark ring at the old border's .35; on the dark page
  // the light ring is .2 (spec §1 --wire-edge).
  await gotoHydrated(page, '/switch/32');
  const ring = await page
    .locator('main .wire i')
    .first()
    .evaluate((el) => getComputedStyle(el).boxShadow);
  const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(ring);
  expect(m, ring).not.toBeNull();
  const [, r, g, b, a = '1'] = m!;
  const dark = r === '0' && g === '0' && b === '0';
  expect(parseFloat(a), ring).toBeGreaterThanOrEqual(dark ? 0.35 : 0.2);
});

test('the handbook Contents heading keeps its display face', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the side contents shows from 1000');
  await gotoHydrated(page, '/handbook/menus');
  const s = await page.locator('aside.side summary').evaluate((el) => ({
    family: getComputedStyle(el).fontFamily,
    weight: getComputedStyle(el).fontWeight,
  }));
  expect(s.family).toContain('Fell');
  expect(s.weight).toBe('400');
});

test.describe('on a 320 phone', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('the part sheet keeps its map and two actions inside the sheet', async ({ page }) => {
    await gotoHydrated(page, '/switch/32');
    await page.getByRole('button', { name: /Show on map/ }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const links = [
      sheet.getByRole('link', { name: 'Show on map' }),
      sheet.getByRole('link', { name: /^Manual p\. / }),
    ];
    await links[1]!.scrollIntoViewIfNeeded();
    const within = async () => {
      const s = (await sheet.boundingBox())!;
      return Promise.all(
        links.map(async (l) => {
          const b = (await l.boundingBox())!;
          return { left: b.x - s.x, right: s.x + s.width - (b.x + b.width), y: b.y, w: b.width };
        }),
      );
    };
    // Nothing in the sheet reaches past its edge: the map crop fits the 288 column, too.
    const body = sheet.locator('.body');
    expect(await body.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
    // 288 is too narrow for both labels, so they stack, each inside the sheet's 16 padding.
    for (const b of await within()) {
      expect(b.left).toBeGreaterThanOrEqual(15.5);
      expect(b.right).toBeGreaterThanOrEqual(15.5);
    }
    // With room for both they share one row at equal widths.
    await page.setViewportSize({ width: 412, height: 800 });
    const [a, c] = await within();
    expect(Math.abs(a!.y - c!.y)).toBeLessThan(1);
    expect(Math.abs(a!.w - c!.w)).toBeLessThan(1);
    expect(c!.right).toBeGreaterThanOrEqual(15.5);
  });
});

test('a hovered list row shows the press tint, from a pointer that hovers (VL3-07)', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'a touch pointer has no hover');
  await gotoHydrated(page, '/tables');
  const row = page.locator('ul.lst > li > a.lrow').first();
  const bg = () => row.evaluate((el) => getComputedStyle(el).backgroundColor);
  const rest = await bg();
  expect(rest).toBe('rgba(0, 0, 0, 0)');
  await row.hover();
  // The token as a painted colour: the build writes it as hex, the computed style as rgba.
  const press = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement('div'));
    probe.style.backgroundColor = 'var(--press)';
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  });
  await expect.poll(bg).toBe(press);
  await page.mouse.move(0, 0);
  await expect.poll(bg).toBe(rest);
});
