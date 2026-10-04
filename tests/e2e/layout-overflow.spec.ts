import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoHydrated, hydrated } from './helpers';
import { TABS } from '~/lib/nav';
import { SECTIONS } from '~/lib/handbook/sections';
import { SETUP_STEPS } from '~/data/setup';

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
    const wrappers = await page
      .locator('.prose .scroll-x')
      .evaluateAll((els) =>
        els.map((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })),
      );
    expect(wrappers.some((w) => w.scrollWidth > w.clientWidth)).toBe(true);
  });
});

/* P2 item 4 of the app audit (VP-04, VP-12, VL-06, VL-07, VL-01, VL-04, VL-05, VL-08, VL-09,
   VL-10, VP-05, VP-06, VP-07, UX-15, VP-08): tables, matrices and large screens. Each width runs
   on one project: phone widths on phone-dark, widths from 600 on desktop-light. */
const onWidth = (width: number) =>
  test.skip(({ isMobile }) => isMobile !== width < 600, 'each width runs on one project');

async function at(page: Page, width: number, url: string, height = 900) {
  await page.setViewportSize({ width, height });
  await gotoHydrated(page, url);
}

const rootPx = (page: Page, name: string) =>
  page.evaluate(
    (n) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0,
    name,
  );

// The two switch tabs are not neighbours: a hash-only goto would not reload the page.
const TABLE_PAGES = ['/switches#j205', '/lamps', '/switches#j806', '/coils', '/parts', '/fuses'];
const MATRICES = ['/switches', '/lamps'];
const cellLink = (page: Page, id: string) => page.locator(`table.matrix [data-cell="${id}"]`);
const matrixWrap = (page: Page) => page.locator('.scroll-x', { has: page.locator('table.matrix') });
/** The words of the shown `sel` elements whose line boxes sit on more than one line: a code token
 *  (J208-1, U18-11) must not break inside itself, at its hyphen or anywhere else. */
const brokenTokens = (page: Page, sel: string) =>
  page.locator(sel).evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .flatMap((el) => {
        const out: string[] = [];
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          for (const m of n.textContent!.matchAll(/\S+/g)) {
            const range = document.createRange();
            range.setStart(n, m.index);
            range.setEnd(n, m.index + m[0].length);
            const tops = new Set<number>();
            for (const b of range.getClientRects()) if (b.width > 0) tops.add(Math.round(b.top));
            if (tops.size > 1) out.push(m[0]);
          }
        }
        return out;
      }),
  );

test.describe('P2-4: no horizontal page scroll at any width', () => {
  const pages = [
    ...TABLE_PAGES,
    '/tables',
    '/workshop',
    '/map?layer=sw&id=32',
    '/coil/01',
    '/manual/ops/106',
    '/handbook/tests',
    '/care',
    '/setup',
    '/',
  ];
  for (const width of [320, 360, 412, 600, 1000, 1280, 1366, 1440]) {
    test.describe(`${width}px`, () => {
      onWidth(width);

      test('tables, matrices, hubs, map, manual, handbook, care and Diagnose fit', async ({
        page,
      }) => {
        for (const url of pages) {
          await at(page, width, url);
          expect(await scrollWidthOf(page), url).toBeLessThanOrEqual(width);
        }
        for (const url of MATRICES) {
          await at(page, width, url);
          await cellLink(page, '32').focus();
          expect(await scrollWidthOf(page), `${url}, cell 32`).toBeLessThanOrEqual(width);
        }
      });
    });
  }
});

test.describe('P2-4: tables (spec §8.9)', () => {
  test('every column has a header', async ({ page, isMobile }) => {
    test.skip(isMobile, 'width-independent');
    for (const url of TABLE_PAGES) {
      await gotoHydrated(page, url);
      const blank = await page
        .locator('table.t th')
        .evaluateAll((ths) => ths.filter((th) => !th.textContent?.trim()).length);
      expect(blank, url).toBe(0);
    }
  });

  /* Known overflows by engine, width and page; a fix makes the count 0 and fails here, so the
     entry goes with it. None now: the magnets' "(under the playfield)" that ran 1.06 px past its
     cell at 320 in WebKit sits in the fuse link's own block since audit round 2 P3 item 2. */
  const KNOWN_SCROLLS: Record<string, number> = {};
  for (const width of [320, 360, 412]) {
    test.describe(`${width}px`, () => {
      onWidth(width);

      test('rows fit: no scroll, no broken code, 44 ticks in view', async ({
        page,
        browserName,
      }) => {
        for (const url of TABLE_PAGES) {
          await at(page, width, url);
          const r = await page.evaluate((w) => {
            const shown = (el: Element) => (el as HTMLElement).offsetParent !== null;
            // The line boxes of each word: a code token (J205-1, 24-8768) must not break.
            const brokenWords = (el: Element) => {
              const out: string[] = [];
              const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
              for (let n = walk.nextNode(); n; n = walk.nextNode()) {
                for (const m of n.textContent!.matchAll(/\S+/g)) {
                  const range = document.createRange();
                  range.setStart(n, m.index);
                  range.setEnd(n, m.index + m[0].length);
                  const tops = new Set<number>();
                  for (const b of range.getClientRects())
                    if (b.width > 0) tops.add(Math.round(b.top));
                  if (tops.size > 1) out.push(m[0]);
                }
              }
              return out;
            };
            const hits = [...document.querySelectorAll('.chk-hit')]
              .filter(shown)
              .map((l) => l.getBoundingClientRect());
            let overlaps = 0;
            for (let i = 1; i < hits.length; i++) {
              const a = hits[i - 1]!;
              const b = hits[i]!;
              if (a.bottom > b.top + 0.5 && a.right > b.left && b.right > a.left) overlaps++;
            }
            return {
              scrolls: [...document.querySelectorAll('.scroll-x')]
                .filter(shown)
                .filter((s) => s.scrollWidth > s.clientWidth).length,
              broken: [...document.querySelectorAll('table.t td.mono, table.t td > .mono')]
                .filter(shown)
                .flatMap(brokenWords),
              small: hits.filter((b) => b.width < 44 || b.height < 44).length,
              off: hits.filter((b) => b.right > w).length,
              overlaps,
            };
          }, width);
          const scrolls = KNOWN_SCROLLS[`${browserName} ${width} ${url}`] ?? 0;
          expect(r, url).toEqual({ scrolls, broken: [], small: 0, off: 0, overlaps: 0 });
        }
      });

      test('two-line rows: id and tick on the first line, body-face labels, no empty pair', async ({
        page,
      }) => {
        for (const url of ['/coils', '/lamps']) {
          await at(page, width, url);
          const r = await page.evaluate(() => {
            const shown = (el: Element) => (el as HTMLElement).offsetParent !== null;
            const firstLine = (el: Element) => {
              const range = document.createRange();
              range.selectNodeContents(el);
              const b = [...range.getClientRects()].find((x) => x.width > 0)!;
              return (b.top + b.bottom) / 2;
            };
            const rows = [...document.querySelectorAll('table.t.two tbody tr')].filter(shown);
            let off = 0;
            for (const tr of rows) {
              const [key, nm, hit] = ['td.key', 'td.nm', '.chk-hit'].map((s) =>
                tr.querySelector(s),
              );
              if (!key || !nm || !hit) continue;
              const line = firstLine(nm);
              const h = hit.getBoundingClientRect();
              off = Math.max(
                off,
                Math.abs(firstLine(key) - line),
                Math.abs((h.top + h.bottom) / 2 - line),
              );
            }
            const pairs = [
              ...document.querySelectorAll<HTMLElement>('table.t.two td[data-h]'),
            ].filter(shown);
            const body = getComputedStyle(document.body).fontFamily;
            return {
              rows: rows.length > 0,
              off: off <= 4,
              empty: pairs.filter((td) => !td.textContent!.trim()).map((td) => td.dataset.h),
              dotted: [...document.querySelectorAll('table.t.two td.nm .note')]
                .filter(shown)
                .filter((n) => (n as HTMLElement).innerText.trim().startsWith('·')).length,
              monoLabels: pairs.filter((td) => getComputedStyle(td, '::before').fontFamily !== body)
                .length,
              location: [
                ...new Set(
                  pairs
                    .filter((td) => td.dataset.h === 'Location')
                    .map((td) => td.textContent!.trim()),
                ),
              ].sort(),
            };
          });
          expect(r, url).toEqual({
            rows: true,
            off: true,
            empty: [],
            dotted: 0,
            monoLabels: 0,
            location: url === '/coils' ? ['in cabinet', 'under playfield'] : [],
          });
        }
      });

      test('the tables keep their rows for assistive tech', async ({ page }) => {
        for (const url of TABLE_PAGES) {
          await at(page, width, url);
          const table = page.locator('table.t:visible').first();
          await expect(table.locator('tbody tr').first()).toBeAttached();
          const trs = await table.locator('tbody tr').count();
          await expect(table.getByRole('row'), url).toHaveCount(trs + 1);
        }
      });
    });
  }

  for (const width of [1000, 1280, 1440]) {
    test(`at ${width} no table scrolls sideways`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'a desktop width');
      for (const url of TABLE_PAGES) {
        await at(page, width, url);
        const over = await page.evaluate(() =>
          [...document.querySelectorAll('.scroll-x')]
            .filter((s) => (s as HTMLElement).offsetParent !== null)
            .filter((s) => s.scrollWidth > s.clientWidth)
            .map((s) => `${s.scrollWidth}/${s.clientWidth}`),
        );
        expect(over, url).toEqual([]);
      }
    });
  }

  test('at 600 the Fault column stays inside the solenoid wrapper', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a desktop width');
    await at(page, 600, '/coils');
    const wrap = page.locator('.scroll-x', { has: page.locator('td.chk') }).first();
    const edges = () =>
      wrap.evaluate((w) => {
        const chk = w.querySelector('tbody tr:last-child td.chk')!;
        return [chk.getBoundingClientRect().right, w.getBoundingClientRect().right];
      });
    const [chk, box] = await edges();
    expect(chk).toBeLessThanOrEqual(box! + 0.5);
    await wrap.evaluate((w) => (w.scrollLeft = w.scrollWidth));
    const [chk2, box2] = await edges();
    expect(chk2).toBeLessThanOrEqual(box2! + 0.5);
  });
});

test.describe('P2-4: matrices (spec §9.6)', () => {
  for (const width of [1000, 1280, 1440]) {
    test(`fit the column with no sideways scroll at ${width}`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'a desktop width');
      for (const url of MATRICES) {
        await at(page, width, url);
        const [sw, cw] = await matrixWrap(page).evaluate((w) => [w.scrollWidth, w.clientWidth]);
        expect(sw, url).toBeLessThanOrEqual(cw!);
        // The header pins wrap between codes, never inside one: 'J208-1 · U18-11' broke after
        // U18's hyphen in the 104 of the fixed row-header column.
        expect(await brokenTokens(page, 'table.matrix .pin'), url).toEqual([]);
      }
    });
  }
  for (const width of [320, 360, 412]) {
    test.describe(`${width}px`, () => {
      onWidth(width);

      test('fit the phone with 24 × 44 cells, the wire swatches and the row/col hint', async ({
        page,
      }) => {
        for (const url of MATRICES) {
          await at(page, width, url);
          const r = await matrixWrap(page).evaluate((w) => {
            const cells = [...w.querySelectorAll('tbody td')].map((td) =>
              td.getBoundingClientRect(),
            );
            const corner = w.querySelector('.corner')!.getBoundingClientRect();
            return {
              scrolls: w.scrollWidth > w.clientWidth,
              narrow: cells.filter((b) => b.width < 24).length,
              short: cells.filter((b) => b.height < 44).length,
              // Every row and column header keeps its wire's colour.
              noSwatch: [...w.querySelectorAll('.colh, .rowh')].filter((h) => {
                const b = h.querySelector('.wire i')?.getBoundingClientRect();
                return !b || b.width < 8 || b.height < 6;
              }).length,
              // The corner reads 'row ↓' over 'col →', each on one line inside it.
              hint: [...w.querySelectorAll('.corner .way > span')]
                .filter((s) => getComputedStyle(s).display !== 'none')
                .map((s) => {
                  const range = document.createRange();
                  range.selectNodeContents(s);
                  const b = s.getBoundingClientRect();
                  const inside = b.left >= corner.left - 0.5 && b.right <= corner.right + 0.5;
                  return `${s.textContent} ${range.getClientRects().length} ${inside}`;
                }),
            };
          });
          expect(r, url).toEqual({
            scrolls: false,
            narrow: 0,
            short: 0,
            noSwatch: 0,
            hint: ['row ↓ 1 true', 'col → 1 true'],
          });
        }
      });
    });
  }
  for (const [width, height] of [
    [412, 839],
    [1000, 900],
  ] as const) {
    test.describe(`${width}×${height}`, () => {
      onWidth(width);

      test('a keyboard selection brings the card into view, the cell too', async ({ page }) => {
        for (const url of MATRICES) {
          await at(page, width, url, height);
          await cellLink(page, '88').focus();
          const limit = height - (await rootPx(page, '--tabbar-h'));
          const top = await rootPx(page, '--topbar-h');
          await expect
            .poll(() =>
              page.locator('[data-cell-card]').evaluate((c) => c.getBoundingClientRect().bottom),
            )
            .toBeLessThanOrEqual(limit + 0.5);
          const cell = (await cellLink(page, '88').boundingBox())!;
          expect(cell.y, url).toBeGreaterThanOrEqual(top - 0.5);
          expect(cell.y + cell.height, url).toBeLessThanOrEqual(limit + 0.5);
        }
      });
    });
  }

  test('at 768 the row headers stay pinned while focus moves right', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a desktop width');
    for (const url of MATRICES) {
      await at(page, 768, url);
      await cellLink(page, '88').focus();
      const wrapLeft = await matrixWrap(page).evaluate((w) => w.getBoundingClientRect().left);
      const lefts = await page
        .locator('table.matrix th.rowh')
        .evaluateAll((ths) => ths.map((th) => th.getBoundingClientRect().left));
      expect(Math.min(...lefts), url).toBeGreaterThanOrEqual(wrapLeft - 0.5);
    }
  });
});

test.describe('P2-4: the map from 1000 (spec §7.4, §7.7)', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop widths');
  for (const [width, height] of [
    [1000, 900],
    [1000, 1080],
    [1000, 1200],
    [1024, 1366],
    [1280, 900],
    [1366, 768],
    [1366, 900],
    [1440, 900],
    [1440, 1080],
  ] as const) {
    test(`${width}×${height}: one panel scroller, the card in reach, the glass off the drawing`, async ({
      page,
    }) => {
      await at(page, width, '/map?layer=sw&id=32', height);
      await expect(page.locator('.marker.sel')).toBeVisible();
      const aside = page.locator('aside.side');
      // The card need not fit a short panel at once: it is whole (no scroller or clip of its own)
      // and the panel's one scroller reaches its foot.
      const panel = () =>
        aside.evaluate((a) => {
          const scrollers = [a, ...a.querySelectorAll('*')]
            .filter((e) => {
              const o = getComputedStyle(e).overflowY;
              return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1;
            })
            .map((e) => (e === a ? 'aside' : e.className));
          const card = a.querySelector('.selected');
          const last = card?.lastElementChild;
          if (!card || !last) return { scrollers, clipped: true, reached: false };
          const clipped = card.scrollHeight > card.clientHeight + 1;
          const from = a.scrollTop;
          const below = last.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom;
          if (below > 0) a.scrollTop += below;
          const reached =
            last.getBoundingClientRect().bottom <= a.getBoundingClientRect().bottom + 0.5;
          a.scrollTop = from;
          return { scrollers, clipped, reached };
        });
      const whole = { scrollers: ['aside'], clipped: false, reached: true };
      expect(await panel(), 'a marker').toEqual(whole);

      // No dead band under the list; the last row's card shows at the panel's top.
      await aside.evaluate((a) => (a.scrollTop = a.scrollHeight));
      const [listBottom, asideBottom] = await aside.evaluate((a) => [
        a.querySelector('.listing')!.getBoundingClientRect().bottom,
        a.getBoundingClientRect().bottom,
      ]);
      expect(listBottom, 'the list reaches the foot').toBeGreaterThanOrEqual(asideBottom! - 1);
      await aside.locator('.listing .row').last().click();
      await expect.poll(() => aside.evaluate((a) => a.scrollTop)).toBe(0);
      expect(await panel(), 'the last list row').toEqual(whole);

      // Every glass control, the zoom capsule (.corner) included, clears the drawing.
      const glass = await page.evaluate(() => {
        const img = document.querySelector('.canvas img')!.getBoundingClientRect();
        return ['.layers-list', '.readout', '.legend', '.corner'].map((s) => {
          const r = document.querySelector(s)?.getBoundingClientRect();
          if (!r) return [s, false];
          const x = Math.min(r.right, img.right) - Math.max(r.left, img.left);
          const y = Math.min(r.bottom, img.bottom) - Math.max(r.top, img.top);
          return [s, x > 0 && y > 0];
        });
      });
      expect(glass).toEqual([
        ['.layers-list', false],
        ['.readout', false],
        ['.legend', false],
        ['.corner', false],
      ]);

      const layers = page.getByRole('group', { name: 'Layers' });
      await expect(layers).toHaveCount(1);
      for (const b of await layers.getByRole('button').all()) {
        const box = (await b.boundingBox())!;
        expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
      }
    });
  }
  // The embed (spec §7.9) has no panel: its glass floats where the gutter holds it, otherwise it
  // keeps the phone's control column. It hydrates on `client:visible`, after gotoHydrated returns,
  // so the test waits for its own island and first fit; measured before them, it passed on nothing.
  for (const [width, height] of [
    [1000, 900],
    [1280, 800],
    [1280, 900],
    [1440, 900],
    [1600, 1000],
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    test(`${width}×${height}: the handbook embed keeps its controls off the drawing`, async ({
      page,
    }) => {
      await at(page, width, '/handbook/rules', height);
      const embed = page.locator('#pg-9 .shot-map');
      await embed.scrollIntoViewIfNeeded();
      await expect(embed.locator('astro-island[ssr]')).toHaveCount(0);
      await expect(embed.locator('.canvas.ready img')).toBeVisible();
      const controls = () =>
        embed.evaluate((e) => {
          const img = e.querySelector('.canvas img')!.getBoundingClientRect();
          const shown = ['.layers-list', '.readout', '.legend', '.corner', '.column'].filter((s) =>
            e.querySelector(s),
          );
          const over = shown.filter((s) => {
            const b = e.querySelector(s)!.getBoundingClientRect();
            const x = Math.min(b.right, img.right) - Math.max(b.left, img.left);
            const y = Math.min(b.bottom, img.bottom) - Math.max(b.top, img.top);
            return x > 0 && y > 0;
          });
          return { layers: shown.includes('.layers-list') || shown.includes('.column'), over };
        });
      await expect.poll(controls).toEqual({ layers: true, over: [] });
      await expect(embed.getByRole('group', { name: 'Layers' })).toHaveCount(1);
      // The key legend floats in the gutter or sits under the drawing, once, from 1280.
      await expect(embed.getByRole('note', { name: 'Keyboard shortcuts' })).toHaveCount(
        width >= 1280 ? 1 : 0,
      );
    });
  }
});

test.describe('P2-4: the manual viewer (spec §9.12)', () => {
  test.beforeEach(async ({ page }) => {
    // Once per test, so the default fit applies but a choice survives the page turn.
    await page.addInitScript(() => {
      try {
        if (sessionStorage.getItem('p24-fit-reset')) return;
        sessionStorage.setItem('p24-fit-reset', '1');
        localStorage.removeItem('tafh:manual-fit');
      } catch {
        // Storage blocked: the default applies.
      }
    });
  });

  for (const width of [412, 1000, 1440]) {
    test.describe(`${width}px`, () => {
      onWidth(width);

      test('at the fit the page scrolls, not the stage, and the capsule is in view', async ({
        page,
        browserName,
      }) => {
        test.skip(browserName === 'webkit', 'mouse.wheel is not supported in mobile WebKit');
        await at(page, width, '/manual/ops/106');
        const stage = page.locator('.viewer .stage');
        await expect(stage.locator('img').first()).toBeVisible();
        const nested = await page.locator('.viewer').evaluate((v) =>
          [...v.querySelectorAll('*')]
            .filter((e) => {
              const o = getComputedStyle(e).overflowY;
              return (o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1;
            })
            .map((e) => e.className),
        );
        expect(nested).toEqual([]);
        const vh = page.viewportSize()!.height;
        const capsule = (await page.getByRole('group', { name: 'Zoom' }).boundingBox())!;
        expect(capsule.y).toBeGreaterThanOrEqual(0);
        expect(capsule.y + capsule.height).toBeLessThanOrEqual(vh);
        const box = (await stage.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, Math.min(box.y + 40, vh - 80));
        await page.mouse.wheel(0, 400);
        await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      });
    });
  }
  for (const [width, height] of [
    [412, 839],
    [1000, 900],
    [1280, 720],
    [1366, 768],
    [1440, 900],
  ] as const) {
    test.describe(`${width}×${height}`, () => {
      onWidth(width);

      test('fit page shows the whole scan as the page opens', async ({ page }) => {
        await at(page, width, '/manual/ops/106', height);
        const fit = page.getByRole('button', { name: 'Fit page', exact: true });
        if ((await fit.getAttribute('aria-pressed')) !== 'true') await fit.click();
        await expect(fit).toHaveAttribute('aria-pressed', 'true');
        const stage = page.locator('.viewer .stage');
        await expect(stage.locator('img').first()).toBeVisible();
        const foot = height - (await rootPx(page, '--tabbar-h'));
        await expect
          .poll(() => stage.evaluate((s) => s.getBoundingClientRect().bottom))
          .toBeLessThanOrEqual(foot);
        expect(await page.evaluate(() => scrollY)).toBe(0);
      });
    });
  }

  test('the chosen fit is kept across a page turn', async ({ page, isMobile }) => {
    test.skip(isMobile, 'a desktop width');
    await at(page, 1440, '/manual/ops/106');
    const fitWidth = page.getByRole('button', { name: 'Fit width', exact: true });
    await expect(page.getByRole('button', { name: 'Fit page', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await fitWidth.click();
    await expect(fitWidth).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('link', { name: 'Next page' }).click();
    await expect(page).not.toHaveURL(/\/106\/?$/);
    await hydrated(page);
    await expect(fitWidth).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('P2-4: the Diagnose field (spec §9.1)', () => {
  for (const width of [1000, 1440]) {
    test(`${width}: the field is at the top of the column in every mode`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, 'a desktop width');
      await at(page, width, '/');
      const dock = page.locator('.diag .dock');
      const home = await dock.evaluate((d) => ({
        top: d.getBoundingClientRect().top,
        position: getComputedStyle(d).position,
      }));
      expect(home.top).toBeLessThan(450);
      expect(home.position).not.toBe('sticky');
      await at(page, width, '/?q=32');
      await expect(statusRow(page)).toBeVisible();
      const res = await dock.evaluate((d) => ({
        top: d.getBoundingClientRect().top,
        width: d.getBoundingClientRect().width,
        position: getComputedStyle(d).position,
        card: document.querySelector('.diag article.card')!.getBoundingClientRect().top,
      }));
      expect(res.position).not.toBe('sticky');
      expect(res.top).toBeLessThan(res.card);
      expect(res.width).toBeLessThanOrEqual(720);
    });

    test(`${width}: Enter keeps the field in view for the next code`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, 'a desktop width');
      await at(page, width, '/');
      const input = page.getByLabel('Test report or display message');
      await input.fill('32');
      await input.press('Enter');
      await expect(statusRow(page)).toBeVisible();
      // Focus leaves the field for the results heading, and the scroll goes with it.
      await expect(input).not.toBeFocused();
      const top = await rootPx(page, '--topbar-h');
      const box = (await input.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(top);
      expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    });
  }

  test('412: the phone keeps the docked hero and the sticky bar', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'a phone width');
    await at(page, 412, '/', 839);
    const dock = page.locator('.diag .dock');
    const bottom = await dock.evaluate((d) => d.getBoundingClientRect().bottom);
    const tabTop = 839 - (await rootPx(page, '--tabbar-h'));
    expect(bottom).toBeGreaterThan(tabTop - 40);
    expect(bottom).toBeLessThanOrEqual(tabTop);
    await at(page, 412, '/?q=32', 839);
    await expect(statusRow(page)).toBeVisible();
    expect(await dock.evaluate((d) => getComputedStyle(d).position)).toBe('sticky');
  });
});

test.describe('P2-4: widths and measure (spec §3.1)', () => {
  for (const width of [1000, 1280, 1440]) {
    test(`${width}: text blocks set 60-80 characters a line, the embed the article width`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, 'a desktop width');
      // Characters a line, spaces included, read from the layout: every line is at most 80 (a
      // block's last too, so a one-line block cannot run long unseen), and the full lines (not a
      // block's last) average at least 60.
      const lines = (sel: string) =>
        page.locator(sel).evaluateAll((els) => {
          const counts: number[] = [];
          const lasts: number[] = [];
          for (const el of els.filter((e) => (e as HTMLElement).offsetParent !== null)) {
            const perLine = new Map<number, number>();
            const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            let space = true;
            for (let n = walk.nextNode(); n; n = walk.nextNode()) {
              const s = n.textContent!;
              for (let i = 0; i < s.length; i++) {
                const blank = /\s/.test(s[i]!);
                if (blank && space) continue;
                space = blank;
                const range = document.createRange();
                range.setStart(n, i);
                range.setEnd(n, i + 1);
                const b = range.getClientRects()[0];
                if (!b || b.width === 0) continue;
                const k = Math.round(b.top / 4);
                perLine.set(k, (perLine.get(k) ?? 0) + 1);
              }
            }
            const ordered = [...perLine.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
            counts.push(...ordered.slice(0, -1));
            lasts.push(...ordered.slice(-1));
          }
          return [counts, lasts] as const;
        });
      // The least number of full lines each set must have, so a check is not vacuous. The last
      // three are a few long lines: the matrix note, the bench note and Setup's longest item names.
      for (const [url, sel, least] of [
        ['/handbook/tests', '.prose p', 3],
        ['/coil/01', '.notes p', 3],
        ['/care', 'main > p, .intro, .why, .step > p, .prov', 3],
        ['/setup', 'main > p, .intro, .why, .step > p, .prov', 3],
        ['/coils', 'main > p, .prov', 3],
        ['/switches', '.panel > p', 1],
        ['/shopping', '.gf', 1],
        ['/setup', '.item .name', 1],
        ['/shopping', '.lrow.static .txt', 3],
        ['/?q=32%2068%20F1%20F3', '.ctext', 1],
      ] as const) {
        await at(page, width, url);
        const [counts, lasts] = await lines(sel);
        expect(Math.max(...counts, ...lasts), `${url} ${sel}`).toBeLessThanOrEqual(80);
        expect(counts.length, `${url} ${sel}`).toBeGreaterThanOrEqual(least);
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        expect(mean, `${url} ${sel}`).toBeGreaterThanOrEqual(60);
      }
      // The measure narrows the text only: the matrix beside the note and a Setup row's suggested
      // value and Set field keep their column.
      await at(page, width, '/switches');
      const [grid, panel] = await page.evaluate(() => [
        document.querySelector('#panel-matrix .scroll-x')!.getBoundingClientRect().width,
        document.querySelector('#panel-matrix')!.getBoundingClientRect().width,
      ]);
      expect(Math.abs(grid! - panel!)).toBeLessThanOrEqual(1);
      await at(page, width, '/setup');
      const narrowed = await page
        .locator('.item .vals')
        .evaluateAll(
          (vs) =>
            vs.filter(
              (v) =>
                Math.abs(
                  v.getBoundingClientRect().width -
                    v.closest('.body')!.getBoundingClientRect().width,
                ) > 1,
            ).length,
        );
      expect(narrowed).toBe(0);
      await at(page, width, '/handbook/rules');
      const [embed, article] = await page.evaluate(() => [
        document.querySelector('#pg-9 .shot-map')!.getBoundingClientRect().width,
        document.querySelector('article.prose')!.getBoundingClientRect().width,
      ]);
      expect(Math.abs(embed! - article!)).toBeLessThanOrEqual(1);
    });
  }
  for (const width of [320, 412, 600, 1000, 1440]) {
    test.describe(`${width}px`, () => {
      onWidth(width);

      test('hub lists and the search pill start at the content edge', async ({ page }) => {
        for (const url of ['/tables', '/workshop', '/handbook']) {
          await at(page, width, url);
          const r = await page.evaluate(() => {
            const main = document.querySelector('main')!;
            const pad = parseFloat(getComputedStyle(main).paddingLeft);
            const left = (s: string) =>
              [...document.querySelectorAll(s)]
                .find((e) => (e as HTMLElement).offsetParent !== null)
                ?.getBoundingClientRect().left;
            return {
              edge: main.getBoundingClientRect().left + pad,
              lst: left('.hub .lst')!,
              srch: left('.hub .srch') ?? null,
            };
          });
          expect(Math.abs(r.lst - r.edge), `${url} list`).toBeLessThanOrEqual(1);
          if (r.srch !== null) {
            expect(Math.abs(r.srch - r.edge), `${url} search`).toBeLessThanOrEqual(1);
          }
        }
      });
    });
  }
  // 430 is an iPhone Pro Max; the control moves under the label below a 413 row (a 445 viewport).
  for (const width of [320, 412, 419, 420, 430, 444, 445, 460, 599]) {
    test.describe(`${width}px`, () => {
      onWidth(width);

      test('the Appearance label stays whole and clear of its control', async ({ page }) => {
        await at(page, width, '/workshop');
        const r = await page.evaluate(() => {
          const labelEl = document.querySelector('#appearance-label')!;
          const label = labelEl.getBoundingClientRect();
          const rowEl = labelEl.closest('.lrow')!;
          const seg = rowEl.querySelector('.seg')!.getBoundingClientRect();
          const row = rowEl.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(labelEl);
          const tops = new Set([...range.getClientRects()].map((b) => Math.round(b.top)));
          const x = Math.max(0, Math.min(label.right, seg.right) - Math.max(label.left, seg.left));
          const y = Math.max(0, Math.min(label.bottom, seg.bottom) - Math.max(label.top, seg.top));
          const under = seg.top >= label.bottom - 0.5;
          return {
            lines: tops.size,
            overlap: x * y,
            // Under the label it starts at the label's edge; beside it, after the label.
            aligned: under ? Math.abs(seg.left - label.left) <= 2 : seg.left >= label.right,
            over: seg.right - row.right <= 0,
          };
        });
        expect(r).toEqual({ lines: 1, overlap: 0, aligned: true, over: true });
      });
    });
  }

  test('320: the code badge stays on one line', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'a phone width');
    await at(page, 320, '/coil/01', 800);
    const r = await page
      .locator('.code.lg')
      .first()
      .evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return { lines: range.getClientRects().length, height: el.getBoundingClientRect().height };
      });
    expect(r).toEqual({ lines: 1, height: 40 });
  });
});

/* P3 item 1 of the app audit (spec §13): "47 of 47 settings done" and its bar share one line on a
 * 412 phone. With a 160 px bar the bar dropped to a second line from "10 of 47". */
test('at 412 the /setup progress row stays one line with every setting done', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the phone projects');
  // Every phone project measures at the spec's 412. At 390 (phone-webkit's own width) the bar wraps
  // under the text: 358 wide, 224 of text and gaps, 140 of flex-basis (known, not changed).
  await page.setViewportSize({ width: 412, height: page.viewportSize()!.height });
  const ids = SETUP_STEPS.flatMap((s) => s.items.map((i) => i.id));
  expect(ids).toHaveLength(47);
  await page.goto('setup');
  await page.evaluate((list) => {
    const at = '2026-09-23T00:00:00Z';
    const all = Object.fromEntries(list.map((id) => [id, { value: '', done: true, at }]));
    localStorage.setItem('tafh:setup', JSON.stringify(all));
  }, ids);
  await gotoHydrated(page, 'setup');
  expect(page.viewportSize()!.width).toBe(412);
  const row = page.locator('p.progress');
  await expect(row).toContainText('47 of 47');
  expect((await row.boundingBox())!.height).toBeLessThanOrEqual(40);
});

/* P2 item 6 of the app audit, round 2: large screens. Each test names the finding it holds; VL2-06
 * (the measure of the kit rows and the shared-cause text) is in the P2-4 measure test above. */
test.describe('large screens (P2 item 6 of the app audit, round 2)', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop widths');

  test('a sidebar sub-row label keeps the row size (VL2-01)', async ({ page }) => {
    await at(page, 1440, '/switches');
    const sizes = await page
      .locator('.shell .sub .lbl')
      .evaluateAll((ls) =>
        ls.map((l) => `${getComputedStyle(l).fontSize}/${getComputedStyle(l).lineHeight}`),
      );
    expect(sizes.length).toBeGreaterThan(5);
    expect(new Set(sizes)).toEqual(new Set(['15px/20px']));
  });

  test('two Diagnose cards side by side keep their own rows and buttons (VL2-02)', async ({
    page,
  }) => {
    await at(page, 1440, '/?q=12%2013%2068');
    await expect(page.locator('.cards > *')).toHaveCount(3);
    const heights = await page
      .locator('.cards .acts .btn')
      .evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)));
    expect(new Set(heights).size, heights.join(' ')).toBe(1);
  });

  test('a single result lines up with the field: bar, chips and card (VL2-04)', async ({
    page,
  }) => {
    await at(page, 1440, '/?q=32');
    await expect(page.locator('.cards > *')).toHaveCount(1);
    const [field, bar, card] = await Promise.all(
      ['.dock', '.rbar', '.cards > *'].map((sel) => page.locator(sel).first().boundingBox()),
    );
    for (const box of [bar!, card!]) {
      expect(Math.abs(box.x - field!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.x + box.width - (field!.x + field!.width))).toBeLessThanOrEqual(1);
    }
  });

  for (const width of [1024, 1180]) {
    test(`${width}: the map panel's layer toggles show their names (VL2-03)`, async ({ page }) => {
      await at(page, width, '/map');
      const toggles = page.locator('.layers-row .ibtn');
      await expect(toggles).toHaveCount(4);
      await expect(toggles.locator('.lname')).toHaveText([
        'Switches',
        'Lamps',
        'Solenoids',
        'Shots',
      ]);
      // Each name is drawn whole under its glyph, and each toggle keeps a 44 target.
      for (const [w, h, name, room] of await toggles.evaluateAll((bs) =>
        bs.map((b) => {
          const r = b.getBoundingClientRect();
          const n = b.querySelector('.lname')!;
          return [r.width, r.height, n.getBoundingClientRect().width, n.scrollWidth];
        }),
      )) {
        expect(Math.min(w!, h!)).toBeGreaterThanOrEqual(44);
        expect(name).toBeGreaterThan(24);
        expect(name).toBeGreaterThanOrEqual(room! - 1);
      }
    });
  }

  test('the switch matrix headers are fixed lines of one height (VL2-07)', async ({ page }) => {
    await at(page, 1440, '/switches');
    for (const sel of ['.colh .hd', '.rowh .hd']) {
      const heights = await page
        .locator(`#panel-matrix ${sel}`)
        .evaluateAll((hs) => hs.map((h) => Math.round(h.getBoundingClientRect().height)));
      expect(heights, sel).toHaveLength(8);
      expect(new Set(heights).size, `${sel} ${heights.join(' ')}`).toBe(1);
    }
    // A row header's pins read as one line to a screen reader, each code on its own line on screen.
    await expect(page.locator('#panel-matrix .rowh').first()).toContainText('J208-1 · U18-11');
  });

  test('a search pill lines up with the list under it (VL2-09)', async ({ page }) => {
    for (const [url, list] of [
      ['/tables', '.lst'],
      ['/parts', '.scroll-x'],
    ] as const) {
      await at(page, 1440, url);
      const [pill, below] = await Promise.all([
        page
          .locator('.srch .search')
          .first()
          .evaluate((f) => {
            const r = f.getBoundingClientRect();
            const b = parseFloat(getComputedStyle(f).borderLeftWidth);
            return [r.left + b, r.right - b];
          }),
        page.locator(list).evaluateAll((ls) => {
          const r = ls.map((l) => l.getBoundingClientRect()).find((b) => b.width > 0)!;
          return [r.left, r.right];
        }),
      ]);
      expect(Math.abs(pill[0]! - below[0]!), url).toBeLessThanOrEqual(1);
      expect(Math.abs(pill[1]! - below[1]!), url).toBeLessThanOrEqual(1);
    }
  });
});

/* P2 item 5 of the app audit, round 2 (VP2-05): Setup, Care and Verify draw one checklist row, a
 * 44 tick at the top left, the title beside it, the links row under the text, and one progress line. */
test('Setup, Care and Verify share one checklist row and one progress line (VP2-05)', async ({
  page,
}) => {
  const looks: string[] = [];
  for (const url of ['setup', 'care', 'verify']) {
    await gotoHydrated(page, url);
    await expect(page.locator('p.progress progress'), url).toHaveCount(1);
    const row = await page
      .locator('.checklist > li')
      .first()
      .evaluate((li) => {
        const box = (e: Element | null) => e!.getBoundingClientRect();
        const r = box(li);
        const tick = box(li.querySelector('.tick'));
        const title = box(li.querySelector('.title'));
        const links = li.querySelector('.links');
        return {
          columns: getComputedStyle(li).gridTemplateColumns.split(' ').length,
          tick: [Math.round(tick.top - r.top), Math.round(tick.width)],
          beside: title.left >= tick.right && title.top < tick.bottom,
          under: !links || box(links).top >= title.bottom - 1,
        };
      });
    looks.push(JSON.stringify([row.columns, row.tick]));
    expect(row.beside, url).toBe(true);
    expect(row.under, url).toBe(true);
  }
  // The same two columns and the same tick, 44 wide at the row's top, on all three.
  expect(new Set(looks).size, looks.join(' ')).toBe(1);
  expect(JSON.parse(looks[0]!)[0]).toBe(2);
});

/* P2 item 4 of the app audit, round 2: the reading surfaces on a phone. Each test names the finding
 * it holds (VP2-01, 04, 08 to 13, 15, 16, 18); VP2-14 (the dark bar's alpha) is held by contrast.spec
 * and VP2-17 (the handbook ranges) by handbook.spec. */
test.describe('reading surfaces on a phone (P2 item 4 of the app audit, round 2)', () => {
  test.skip(({ isMobile }) => !isMobile, 'the phone projects');

  test('a table cut by its scroller fades at the edge that has more to show (VP2-04)', async ({
    page,
  }) => {
    await gotoHydrated(page, 'handbook/quick');
    const all = page.locator('.scroll-x');
    const flags = await all.evaluateAll((list) =>
      list.map((s) => s.scrollWidth > s.clientWidth + 1),
    );
    const edges = (el: Locator) =>
      el.evaluate((s) => {
        const c = getComputedStyle(s);
        return [c.getPropertyValue('--edge-l'), c.getPropertyValue('--edge-r')];
      });
    const cut = all.nth(flags.indexOf(true));
    await expect.poll(() => edges(cut)).toEqual(['0px', '24px']);
    await cut.evaluate((s) => s.scrollTo({ left: s.scrollWidth }));
    await expect.poll(() => edges(cut)).toEqual(['24px', '0px']);
    // A scroller that fits has no timeline to run, so both edges stay solid.
    expect(await edges(all.nth(flags.indexOf(false)))).toEqual(['0px', '0px']);
  });

  test('the fitted map ends left of the control column (VP2-11)', async ({ page }) => {
    await gotoHydrated(page, 'map');
    const gap = async () => {
      const canvas = (await page.locator('.map-ui .canvas').boundingBox())!;
      const column = (await page.locator('.map-controls .column').boundingBox())!;
      return column.x - (canvas.x + canvas.width);
    };
    await expect.poll(gap).toBeGreaterThanOrEqual(4);
  });

  test('the manual viewer: zoom under the scan, contents title in the header (VP2-12, 13)', async ({
    page,
  }) => {
    await gotoHydrated(page, 'manual/ops/10');
    const stage = page.locator('.viewer .stage');
    await expect(stage.locator('img').first()).toBeVisible();
    await stage.evaluate((s) => s.scrollIntoView({ block: 'end' }));
    const zoom = (await page.getByRole('group', { name: 'Zoom' }).boundingBox())!;
    const box = (await stage.boundingBox())!;
    expect(zoom.y).toBeGreaterThanOrEqual(box.y + box.height - 0.5);
    expect(zoom.width).toBeGreaterThan(zoom.height);
    await expect(page.locator('header.top .short')).toHaveText('Shot maps');
    await expect(page.locator('.viewer .ttl')).toHaveText('p. F · Shot maps');
  });

  test('the fuse and LED tables share their column lines (VP2-16)', async ({ page }) => {
    await gotoHydrated(page, 'fuses');
    const lefts = await page
      .locator('table.ids')
      .evaluateAll((tables) =>
        (tables as HTMLTableElement[]).map((t) =>
          [...t.rows[0]!.cells].slice(0, 2).map((c) => Math.round(c.getBoundingClientRect().left)),
        ),
      );
    expect(lefts.length).toBeGreaterThan(1);
    for (const l of lefts) expect(l).toEqual(lefts[0]);
  });

  test('an untested part shows Not tested chosen, and it stays chosen (VP2-01)', async ({
    page,
  }) => {
    await gotoHydrated(page, 'switch/32');
    const row = statusRow(page);
    const pressed = () =>
      row
        .getByRole('button')
        .evaluateAll((b) =>
          b
            .filter((x) => x.getAttribute('aria-pressed') === 'true')
            .map((x) => x.textContent!.trim()),
        );
    await expect.poll(pressed).toEqual(['Not tested']);
    await row.getByRole('button', { name: 'Not tested' }).click();
    await expect.poll(pressed).toEqual(['Not tested']);
    await row.getByRole('button', { name: 'OK' }).click();
    await expect.poll(pressed).toEqual(['OK']);
    await row.getByRole('button', { name: 'OK' }).click();
    await expect.poll(pressed).toEqual(['Not tested']);
  });

  test('the Text size sheet fits its control and keeps the page bright (VP2-10)', async ({
    page,
  }) => {
    await gotoHydrated(page, 'handbook/tests');
    await page.getByRole('button', { name: 'Text size' }).click();
    const sheet = page.getByRole('dialog', { name: 'Text size' });
    await expect(sheet).toBeVisible();
    expect((await sheet.boundingBox())!.height).toBeLessThan(200);
    expect(await page.locator('.scrim').evaluate((s) => getComputedStyle(s).backgroundColor)).toBe(
      'rgba(0, 0, 0, 0)',
    );
  });

  test('at the end of a handbook section the footer clears the reader bar (VP2-09)', async ({
    page,
  }) => {
    await gotoHydrated(page, 'handbook/tests');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const clear = async () => {
      const foot = (await page.locator('footer.foot').boundingBox())!;
      const bar = (await page.locator('nav.rbar').boundingBox())!;
      return bar.y - (foot.y + foot.height);
    };
    await expect.poll(clear).toBeGreaterThanOrEqual(-0.5);
  });

  test('the manual search shows its whole placeholder (VP2-08)', async ({ page }) => {
    await gotoHydrated(page, 'manual');
    const field = page.locator('input[aria-label="Search the manuals"]');
    await expect(field).toHaveAttribute('placeholder', 'Search');
  });

  test('every Workshop row has its own icon (VP2-15)', async ({ page }) => {
    await gotoHydrated(page, 'workshop');
    const icons = await page
      .locator('.lst > li')
      .evaluateAll((rows) =>
        rows.map((r) => r.querySelector('svg:not(.chev) path')?.getAttribute('d') ?? ''),
      );
    expect(icons.length).toBeGreaterThan(5);
    expect(new Set(icons).size).toBe(icons.length);
  });

  test('codes in the /verify checks never break at a hyphen (VP2-18)', async ({ page }) => {
    await gotoHydrated(page, 'verify');
    const loose = await page.locator('.checklist .text').evaluateAll((texts) =>
      texts.flatMap((t) => {
        const bare = t.cloneNode(true) as HTMLElement;
        bare.querySelectorAll('.tok').forEach((k) => k.remove());
        return bare.textContent!.match(/\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g) ?? [];
      }),
    );
    expect(loose).toEqual([]);
    const toks = page.locator('.checklist .text .tok');
    expect(await toks.count()).toBeGreaterThan(0);
    expect(await toks.first().evaluate((k) => getComputedStyle(k).whiteSpace)).toBe('nowrap');
  });
});

/* P1 item 2 of the app audit, round 3: one width rule on a tablet and a desktop (DS3-01, VL3-05,
 * VL3-08 to VL3-11). The page column stays --content-w (the matrices and tables need it); inside
 * it, text blocks set the measure, a control after a static row's text sits at the row's end, the
 * three checklists share one meter width, the status control stops at 480 and the Handbook root is a
 * hub like Workshop. */
test.describe('tablet and desktop share one width rule', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop widths');

  for (const width of [1024, 1280, 1440]) {
    test(`${width}: row controls at the edge, text at the measure, one meter, a capped status control`, async ({
      page,
    }) => {
      // DS3-01: every control that ends a row sits where the chevrons do, 16 from the row's edge.
      await at(page, width, '/switch/32');
      const trailing = await page.locator('.lrow').evaluateAll((rows) =>
        rows.flatMap((row) => {
          const last = row.lastElementChild;
          if (!last || !last.matches('.btn, .chev, a, button')) return [];
          if ((row as HTMLElement).offsetParent === null) return [];
          const gap = row.getBoundingClientRect().right - last.getBoundingClientRect().right;
          return [{ what: last.className, gap: Math.round(gap) }];
        }),
      );
      expect(trailing.length).toBeGreaterThan(1);
      expect(trailing.some((t) => /\bbtn\b/.test(t.what))).toBe(true);
      for (const t of trailing) expect(t.gap, t.what).toBeLessThanOrEqual(16);
      // VL3-11: the status control and its note stop at 480.
      const seg = await page.locator('.status .seg').first().boundingBox();
      expect(seg!.width).toBeLessThanOrEqual(480);
      expect(seg!.width).toBeGreaterThan(400);

      // VL3-08: every checklist statement sets the measure, never the column.
      await at(page, width, '/verify');
      const titles = await page.locator('.checklist .title').evaluateAll((els) =>
        els.map((el) => ({
          width: el.getBoundingClientRect().width,
          max: parseFloat(getComputedStyle(el).maxWidth),
        })),
      );
      expect(titles.length).toBeGreaterThan(5);
      for (const t of titles) {
        expect(t.max).toBeLessThan(600);
        expect(t.width).toBeLessThanOrEqual(t.max + 0.5);
      }

      // VL3-10: one meter width on the three checklists.
      const meters: number[] = [];
      for (const url of ['/verify', '/care', '/setup']) {
        await at(page, width, url);
        meters.push((await page.locator('p.progress').boundingBox())!.width);
      }
      expect(Math.max(...meters) - Math.min(...meters), meters.join(' ')).toBeLessThanOrEqual(1);

      // VL3-09: the Handbook root is a hub of the Workshop hub's width.
      const hubs: number[] = [];
      for (const url of ['/handbook', '/workshop']) {
        await at(page, width, url);
        hubs.push((await page.locator('.hub').boundingBox())!.width);
      }
      expect(Math.abs(hubs[0]! - hubs[1]!), hubs.join(' ')).toBeLessThanOrEqual(1);
    });
  }
});

/* P1 item 4 of the app audit, round 3: from 1000 the reader bar is the article column's own, sticky
   at its foot, so it never covers the Contents card beside it, and an end shows a section's short
   title whole (VL3-01). */
test.describe('the reader bar sits on the article column', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop widths');

  for (const width of [1024, 1280, 1440]) {
    test(`${width}: clear of the Contents card, inside the article, whole end labels`, async ({
      page,
    }) => {
      await at(page, width, '/handbook/rules');
      const bar = (await page.locator('nav.rbar').boundingBox())!;
      const card = (await page.locator('.hb > aside.side > details').boundingBox())!;
      const art = (await page.locator('article.prose').boundingBox())!;
      expect(bar.x).toBeGreaterThanOrEqual(card.x + card.width - 0.5);
      expect(bar.x).toBeGreaterThanOrEqual(art.x - 0.5);
      expect(bar.x + bar.width).toBeLessThanOrEqual(art.x + art.width + 0.5);
      // Sticky, not fixed: it stays above the fold while the article scrolls.
      expect(bar.y + bar.height).toBeLessThanOrEqual(900);
      const labels = await page
        .locator('.rb.end .lbl')
        .evaluateAll((els) =>
          els.map((el) => ({ text: el.textContent, clipped: el.scrollWidth > el.clientWidth + 1 })),
        );
      expect(labels.map((l) => l.text)).toContain('Quick reference');
      expect(labels.filter((l) => l.clipped)).toEqual([]);
    });
  }
});
