import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';
import { TABS } from '~/lib/nav';
import { SECTIONS } from '~/lib/handbook/sections';

/* P0 item 3 of the app audit (VP-01, VP-02, VL-02, AY-03, DS-12): `.hb` and `.grid-2` used a plain
   `1fr` track, which is `minmax(auto,1fr)`, so a wide table set the column's minimum and the whole
   page grew past the viewport, pushing the tab bar and reader bar off-screen. The route list below
   comes from the nav model and the handbook section list rather than being hand-typed, so a new
   route is covered automatically. */

const here = path.dirname(fileURLToPath(import.meta.url));
const components = JSON.parse(
  readFileSync(path.resolve(here, '../../src/data/kit/components.json'), 'utf-8'),
) as { switches: { id: string }[]; lamps: { id: string }[]; coils: { id: string }[] };

// `~/lib/pages` imports `pages.json` as a module, which the plain Node ESM loader Playwright runs
// under (unlike Vite/Astro) can't do without an import attribute; read the JSON directly instead,
// same as `components.json` above.
const pages = JSON.parse(
  readFileSync(path.resolve(here, '../../src/data/kit/pages.json'), 'utf-8'),
) as Record<string, [number, ...unknown[]][]>;

function topLevelRoutes(): string[] {
  const routes = new Set<string>();
  for (const tab of TABS) {
    routes.add(tab.path);
    for (const sub of tab.subs) routes.add(sub.path.split('#')[0]!);
  }
  return [...routes].map((r) => `/${r}`);
}

const handbookSectionRoutes = SECTIONS.map((s) => `/handbook/${s.key}`);

// One page per component detail template (src/pages/{switch,lamp,coil}/[id].astro); the ids come
// from the kit data, not a hand-typed list.
const componentKindRoutes = [
  `/switch/${components.switches[0]!.id}`,
  `/lamp/${components.lamps[0]!.id}`,
  `/coil/${components.coils[0]!.id}`,
];

// One manual page (src/pages/manual/[doc]/[page].astro), doc and page number from the same kit
// data getStaticPaths reads (~/lib/pages), not a hand-typed doc id or page number.
const manualDoc = Object.keys(pages)[0]!;
const manualPageRoute = `/manual/${manualDoc}/${pages[manualDoc]![0]![0]}`;

const routes = [
  ...topLevelRoutes(),
  ...handbookSectionRoutes,
  ...componentKindRoutes,
  manualPageRoute,
  '/404',
];

// What the user sees after a search or a tap, not just each route's empty state. The Diagnose
// results overflowed a 320px phone while every route above fitted: the result card's implicit
// auto column took its MiniMap's fixed 310px as the minimum. Each state waits until it renders.
const statusRow = (page: Page) => page.getByRole('group', { name: 'Test status' }).first();
const resultStates: [string, (page: Page) => Locator][] = [
  ['/?q=32', statusRow],
  ['/?q=F5', statusRow],
  ['/?q=check switch 32', statusRow],
  ['/?q=lamp 55', statusRow],
  ['/map?layer=sw&id=32', (page) => page.locator('.marker.sel')],
];

async function gotoState(page: Page, url: string, ready: (page: Page) => Locator) {
  await gotoHydrated(page, url);
  await expect(ready(page)).toBeVisible();
}

// On the phone-dark project Chromium's mobile emulation grows the *layout* viewport itself to fit
// overflowing content (real mobile browsers zoom out to show it), so a live `window.innerWidth`
// read after the page has laid out would inflate right along with the bug and never fail. The
// project's configured viewport size is fixed from the Node side, so it stays the ground truth.
async function scrollWidthOf(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test.describe('no route overflows the viewport horizontally', () => {
  for (const route of routes) {
    test(`${route} fits the viewport width`, async ({ page }) => {
      await gotoHydrated(page, route);
      const { width } = page.viewportSize()!;
      expect(await scrollWidthOf(page)).toBeLessThanOrEqual(width);
    });
  }
  for (const [state, ready] of resultStates) {
    test(`${state} fits the viewport width`, async ({ page }) => {
      await gotoState(page, state, ready);
      const { width } = page.viewportSize()!;
      expect(await scrollWidthOf(page)).toBeLessThanOrEqual(width);
    });
  }
});

// WCAG 1.4.10 reflow is measured at 320 CSS px (AY-03), and small Android phones are 360 wide. The
// project viewport (412) hid a /setup overflow at both: U.5's long suggested value did not wrap.
test.describe('no route overflows a narrow phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone widths');
  for (const route of routes) {
    test(`${route} fits 320 and 360px`, async ({ page }) => {
      for (const width of [320, 360]) {
        await page.setViewportSize({ width, height: 800 });
        await gotoHydrated(page, route);
        expect(await scrollWidthOf(page), `${width}px`).toBeLessThanOrEqual(width);
      }
    });
  }
  // Once the card fits, each status button is about 83px wide at 320: the label has to stay on
  // one line inside it, not spill over its neighbour (the global 12px padding pushed it out).
  test('the status labels fit their buttons at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await gotoState(page, '/?q=32', statusRow);
    const labels = await statusRow(page)
      .getByRole('button')
      .evaluateAll((bs) =>
        bs.map((b) => {
          const r = document.createRange();
          r.selectNodeContents(b);
          return {
            label: b.textContent?.trim(),
            spill: b.scrollWidth > b.clientWidth,
            lines: r.getClientRects().length,
          };
        }),
      );
    expect(labels).toEqual([
      { label: 'OK', spill: false, lines: 1 },
      { label: 'Fault', spill: false, lines: 1 },
      { label: 'Not tested', spill: false, lines: 1 },
    ]);
  });
  for (const [state, ready] of resultStates) {
    test(`${state} fits 320 and 360px`, async ({ page }) => {
      for (const width of [320, 360]) {
        await page.setViewportSize({ width, height: 800 });
        await gotoState(page, state, ready);
        expect(await scrollWidthOf(page), `${width}px`).toBeLessThanOrEqual(width);
      }
    });
  }
});

test.describe('/coils fits the viewport at intermediate widths', () => {
  for (const width of [600, 768, 1024, 1366]) {
    test(`${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoHydrated(page, '/coils');
      expect(await scrollWidthOf(page)).toBeLessThanOrEqual(width);
    });
  }
});

// Regression guard: fitting the page by crushing a table's columns (e.g. an over-broad
// `overflow-wrap: anywhere`) would pass every assertion above while ruining the table. A wide
// handbook table must instead overflow its own `.scroll-x` wrapper so the wrapper scrolls.
test.describe('wide handbook tables scroll in their own wrapper instead of being crushed', () => {
  test('/handbook/presets has a table wider than its .scroll-x wrapper', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 839 }); // phone-dark's viewport (Pixel 7)
    await gotoHydrated(page, '/handbook/presets');
    const wrappers = await page.$$eval('.prose .scroll-x', (els) =>
      els.map((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })),
    );
    expect(wrappers.some((w) => w.scrollWidth > w.clientWidth)).toBe(true);
  });
});
