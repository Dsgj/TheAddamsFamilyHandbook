import { expect, test, type Page } from '@playwright/test';
import { hydrated } from './helpers';

/**
 * Payload (audit P4 item 5): what a page loads and when.
 * - no island hydrates inside a display:none box (SV-10, SV-05: a hidden island is client:media,
 *   not client:load), checked on every island of four representative pages;
 * - a tiled manual page requests the four tiles only after a zoom (PF-06);
 * - the shell logo is requested only where its box shows (PF-10, loading="lazy"), and there it is
 *   the 480x243 asset (under 48 KB);
 * - the Contents list opens on an uncontrolled page offline (PF-05/SV-05: the TOC rides in the
 *   page, no fetch);
 * - after an online visit under the service worker, the tiles zoom offline (PF-06 keeps the
 *   offline promise: the tiles are warmed into the runtime cache at idle).
 */
const TILES = ['10_00.png', '10_01.png', '10_10.png', '10_11.png'];
const MISSING = "isn't on the device yet";

/** Zoom in (x1.2 a click) until the viewer swaps the overview for the tiles (scale >= 0.3). */
async function zoomToTiles(page: Page) {
  for (let i = 0; i < 16 && !(await page.locator('img.tile').count()); i++) {
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.waitForTimeout(120);
  }
}

const cachedTiles = (page: Page) =>
  page.evaluate(async () => {
    const out: string[] = [];
    for (const k of await caches.keys()) {
      if (!/scans/.test(k)) continue;
      for (const r of await (await caches.open(k)).keys()) out.push(r.url.split('/').pop() ?? '');
    }
    return out.filter((u) => /^10_(00|01|10|11)\.png$/.test(u)).sort();
  });

test.describe('payload on an uncontrolled page', () => {
  // a first visit: no service worker answers, every request reaches the network
  test.use({ serviceWorkers: 'block' });

  for (const route of ['/', '/handbook/rules', '/manual/wpc/10', '/verify']) {
    test(`no island hydrates inside a display:none box on ${route}`, async ({ page }) => {
      await page.goto(route);
      await hydrated(page);
      await page.waitForTimeout(300);
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll('astro-island')]
          .filter((el) => {
            for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
              if (getComputedStyle(n).display === 'none') return true;
            }
            return false;
          })
          .map((el) => ({
            island: (el.getAttribute('component-url') ?? '').split('/').pop()?.split('.')[0],
            client: el.getAttribute('client'),
            hydrated: !el.hasAttribute('ssr'),
          })),
      );
      // whatever sits in a hidden box stays server-rendered and is not client:load
      expect(hidden.filter((i) => i.hydrated || i.client === 'load')).toEqual([]);
    });
  }

  test('a tiled manual page requests its tiles only after a zoom', async ({ page }) => {
    const tiles: string[] = [];
    let overview = 0;
    page.on('request', (r) => {
      const f = r.url().split('/').pop() ?? '';
      if (TILES.includes(f)) tiles.push(f);
      if (f === '10_o.png') overview++;
    });
    await page.goto('/manual/wpc/10');
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    // the overview stands in for the four tiles until the zoom
    expect(overview).toBeGreaterThan(0);
    expect(tiles).toEqual([]);
    await zoomToTiles(page);
    await expect(page.locator('img.tile')).toHaveCount(4);
    await page.waitForLoadState('networkidle');
    expect(tiles.sort()).toEqual(TILES);
  });

  test('the shell logo is requested only where its box shows', async ({ page }) => {
    let logo = 0;
    const bodies: Promise<number>[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/brand/logo.webp')) logo++;
    });
    page.on('response', (r) => {
      if (r.url().includes('/brand/logo.webp')) bodies.push(r.body().then((b) => b.length));
    });
    await page.goto('/');
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    const shown = await page.locator('a.shell-logo img').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    expect(logo).toBe(shown ? 1 : 0);
    // phones: no response at all; desktop: the 480x243 asset (47,390 B), not the 800x406 one
    const sizes = await Promise.all(bodies);
    expect(sizes).toHaveLength(shown ? 1 : 0);
    for (const n of sizes) expect(n).toBeLessThan(49_152);
  });

  test('the Contents list opens offline', async ({ page, context }) => {
    const fetched: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('data/handbook.json')) fetched.push(r.url());
    });
    await page.goto('/handbook/rules');
    await hydrated(page);
    await page.waitForLoadState('networkidle');
    await context.setOffline(true);
    // under 1000 the list is the Contents sheet, from 1000 the sidebar
    const wide = (page.viewportSize()?.width ?? 0) >= 1000;
    if (!wide) await page.getByRole('button', { name: 'Contents' }).click();
    const scope = wide ? page.locator('.side') : page.getByRole('dialog', { name: 'Contents' });
    await expect(scope.getByRole('link', { name: 'Utilities' }).first()).toBeVisible();
    const before = await scope.getByRole('link').count();
    expect(before).toBeGreaterThan(100);
    await scope.getByLabel('Search the handbook').fill('util');
    await expect.poll(() => scope.getByRole('link').count()).toBeLessThan(before);
    // the filtered list itself, not just any link left in the box
    await expect(scope.getByRole('link', { name: 'Utilities' }).first()).toBeVisible();
    expect(fetched).toEqual([]);
  });
});

test.describe('payload under the service worker', () => {
  test('the tiles zoom offline after an online visit', async ({ page, context, browserName }) => {
    test.skip(
      browserName === 'webkit',
      'service workers are not driven in Playwright WebKit (see pwa.spec)',
    );
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.goto('/manual/wpc/10');
    await hydrated(page);
    // the four tiles reach the runtime cache (at load on the old viewer, at idle on the new one)
    await expect.poll(() => cachedTiles(page), { timeout: 10_000 }).toEqual(TILES);
    await context.setOffline(true);
    await page.reload();
    await hydrated(page);
    await expect(page.getByText(MISSING)).toHaveCount(0);
    await zoomToTiles(page);
    await expect(page.locator('img.tile')).toHaveCount(4);
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.querySelectorAll<HTMLImageElement>('img.tile')].every(
            (i) => i.complete && i.naturalWidth > 0,
          ),
        ),
      )
      .toBe(true);
    await expect(page.getByText(MISSING)).toHaveCount(0);
  });
});

test.describe('payload without JavaScript', () => {
  // the sidebar list is server-rendered (HandbookTocList through the slot): it must be in the html
  // before any island runs, not drawn by the HandbookToc island on hydration
  test.use({ javaScriptEnabled: false, serviceWorkers: 'block' });

  test('the sidebar Contents list is in the page before any script runs', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1000, 'the sidebar shows at 1000 px and up');
    await page.goto('/handbook/rules');
    const side = page.locator('.side');
    expect(await side.getByRole('link').count()).toBeGreaterThan(100);
    await expect(side.getByRole('link', { name: 'Utilities' }).first()).toBeVisible();
  });
});
