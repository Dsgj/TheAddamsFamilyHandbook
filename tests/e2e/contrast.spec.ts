import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

/** P2 item 3 of the app audit (DS-03, DS-04, DS-05, DS-08, AY-04, AY-16; spec §1.1, §8.6, §12):
    every visible text node and placeholder meets WCAG AA over its composited backdrop, in both
    themes; the state rings meet 3:1; both DMD surfaces read the DMD tokens; and print is black on
    white with the chrome hidden and the page title printed once, whatever the theme.

    Each route runs twice: in the project's colour scheme, and with the other theme forced through
    `tafh:theme`, which Base.astro applies before the first paint, so nothing is measured in the
    middle of a theme transition. */

type Theme = 'light' | 'dark';
type Mode = 'scheme' | 'forced';
const MODES: Mode[] = ['scheme', 'forced'];

function themeOf(mode: Mode): Theme {
  const scheme = test.info().project.use.colorScheme === 'light' ? 'light' : 'dark';
  if (mode === 'scheme') return scheme;
  return scheme === 'light' ? 'dark' : 'light';
}

async function forceTheme(page: Page, mode: Mode) {
  if (mode === 'scheme') return;
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('tafh:theme', t);
    } catch {
      /* no storage: the scheme decides */
    }
  }, themeOf(mode));
}

/** Waits for the page's finite animations and transitions (a pressed segment, the marker's pulse,
    a sheet rising), at most 2 s. */
async function animationsDone(page: Page) {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((a) => {
      const end = a.effect?.getComputedTiming().endTime;
      return typeof end === 'number' && Number.isFinite(end);
    });
    await Promise.race([
      Promise.all(finite.map((a) => a.finished.catch(() => undefined))),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  });
}

async function markSwitchFault(page: Page, id = 32) {
  await gotoHydrated(page, `/switch/${id}`);
  const fault = page
    .getByRole('group', { name: 'Test status' })
    .getByRole('button', { name: 'Fault' });
  await fault.click();
  await expect(fault).toHaveAttribute('aria-pressed', 'true');
}

async function tickFaultLamp(page: Page) {
  await gotoHydrated(page, '/lamps');
  await page.getByLabel('Fault: Thing Multiball').check();
}

/** Runs in the page. Every visible text node and shown placeholder, composited over its DOM
    backdrop (each ancestor's background, scaled by the opacity chain), against 4.5, or 3 at 24px
    and up or 19px and up at 600. The state rings of chosen controls against 3. */
function measure(light: boolean) {
  type C = { r: number; g: number; b: number; a: number };
  const parse = (s: string): C | null => {
    const m = /rgba?\(([^)]+)\)/.exec(s);
    if (!m?.[1]) return null;
    const p = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(parseFloat);
    return { r: p[0] ?? 0, g: p[1] ?? 0, b: p[2] ?? 0, a: p.length > 3 ? (p[3] ?? 1) : 1 };
  };
  const over = (fg: C, bg: C): C => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = ({ r, g, b }: C) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (x: C, y: C) => {
    const a = lum(x);
    const b = lum(y);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const probe = document.createElement('i');
  document.body.append(probe);
  probe.style.color = 'var(--amber)';
  const amber = getComputedStyle(probe).color;
  probe.style.color = 'var(--dmd-ink)';
  const dmdInk = getComputedStyle(probe).color;
  probe.style.backgroundColor = 'var(--dmd-well)';
  const dmdWell = getComputedStyle(probe).backgroundColor;
  probe.remove();

  const backdrop = (el: Element, self: boolean) => {
    const chain: Element[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) chain.unshift(n);
    let bg: C = { r: 255, g: 255, b: 255, a: 1 };
    let opacity = 1;
    for (const n of chain) {
      const cs = getComputedStyle(n);
      opacity *= parseFloat(cs.opacity);
      if (n === el && !self) break;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) bg = over({ ...c, a: c.a * opacity }, bg);
      // A flat tint layered as an image over the colour, linear-gradient(x, x), paints x on top.
      // The shorthand's last layer, the colour's, computes to an image of none.
      const flat = /^linear-gradient\((rgba?\([^)]+\)), (rgba?\([^)]+\))\)(, none)*$/.exec(
        cs.backgroundImage,
      );
      const tint = flat && flat[1] === flat[2] ? parse(flat[1] ?? '') : null;
      if (tint && tint.a > 0) bg = over({ ...tint, a: tint.a * opacity }, bg);
    }
    return { bg, opacity };
  };
  const own = (el: Element) =>
    [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
      .map((n) => n.textContent?.trim())
      .join(' ');
  const name = (el: Element, text: string) =>
    `${el.tagName.toLowerCase()}${[...el.classList]
      .filter((c) => !/^(svelte-|astro-)/.test(c))
      .map((c) => '.' + c)
      .join('')} "${text.slice(0, 32)}"`;
  const needFor = (cs: CSSStyleDeclaration) => {
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    return size >= 24 || (size >= 19 && weight >= 600) ? 3 : 4.5;
  };
  const rings = (shadow: string) =>
    shadow === 'none'
      ? []
      : shadow.split(/,(?![^(]*\))/).flatMap((part) => {
          const c = parse(part);
          const px = part
            .replace(/rgba?\([^)]*\)/, '')
            .trim()
            .split(/\s+/)
            .filter((w) => w.endsWith('px'))
            .map(parseFloat);
          const [x = 0, y = 0, blur = 0, spread = 0] = px;
          return c && c.a > 0 && x === 0 && y === 0 && blur === 0 && spread > 0
            ? [{ c, inset: /\binset\b/.test(part) }]
            : [];
        });

  // The pane is measured in its own test while dragged; unselected marker labels sit on the photo
  // (the selected one has an opaque chip); the Workshop's pull line is a gesture hint.
  const SKIP = '[inert], .sr-only, .pane, .ptr';
  const RING =
    ".chip.on, .btn[aria-pressed='true'], .seg > [aria-pressed='true'], " +
    ".seg > [aria-selected='true'], .seg > [aria-current], td a.target";
  const fails = new Set<string>();
  const amberText = new Set<string>();
  const dmd = new Set<string>();
  const primary: number[] = [];
  let texts = 0;
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest(SKIP) || el.matches('.marker:not(.sel) span')) continue;
    if (!el.checkVisibility({ visibilityProperty: true })) continue;
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) continue;
    const cs = getComputedStyle(el);
    const text = own(el);
    const fg = parse(cs.color);
    if (text && fg) {
      const { bg, opacity } = backdrop(el, true);
      if (fg.a * opacity > 0) {
        texts++;
        const k = ratio(over({ ...fg, a: fg.a * opacity }, bg), bg);
        const need = needFor(cs);
        if (k < need) fails.add(`${name(el, text)} ${k.toFixed(2)} < ${need}`);
        if (light && cs.color === amber) amberText.add(name(el, text));
        if (el.matches('.btn.primary')) primary.push(k);
      }
    }
    if (
      (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
      el.placeholder &&
      !el.value
    ) {
      const ps = getComputedStyle(el, '::placeholder');
      const pc = parse(ps.color);
      if (pc) {
        const { bg, opacity } = backdrop(el, true);
        const k = ratio(over({ ...pc, a: pc.a * parseFloat(ps.opacity) * opacity }, bg), bg);
        const need = needFor(cs);
        const what = `${name(el, el.placeholder)}::placeholder`;
        if (k < need) fails.add(`${what} ${k.toFixed(2)} < ${need}`);
        if (light && ps.color === amber) amberText.add(what);
      }
    }
    if (el.matches(RING)) {
      const outer = backdrop(el, false).bg;
      const inner = backdrop(el, true).bg;
      const best = Math.max(
        0,
        ...rings(cs.boxShadow).map(({ c, inset }) => {
          const painted = over(c, inset ? inner : outer);
          return Math.max(ratio(painted, outer), ratio(painted, inner));
        }),
      );
      if (best < 3)
        fails.add(`${name(el, el.textContent?.trim() ?? '')} ring ${best.toFixed(2)} < 3`);
    }
    // The map list's selected id tile turns amber on purpose (spec §7.7).
    if (el.matches('.dmd, .well') && !el.matches('.row.sel .tile')) {
      if (cs.color !== dmdInk || cs.backgroundColor !== dmdWell)
        dmd.add(`${name(el, text)} ${cs.color} on ${cs.backgroundColor}`);
    }
  }
  const ground = parse(getComputedStyle(document.body).backgroundColor);
  const paper = ground ? lum(ground) : 0;
  return { paper, texts, fails: [...fails], amberText: [...amberText], dmd: [...dmd], primary };
}

type Route = {
  name: string;
  path: string;
  before?: (page: Page) => Promise<void>;
  prep?: (page: Page) => Promise<void>;
};
const ROUTES: Route[] = [
  { name: 'Diagnose home', path: '/' },
  { name: 'Diagnose results', path: '/?q=32' },
  { name: 'switch 32 marked Fault', path: '/switch/32', before: markSwitchFault },
  {
    name: 'switch matrix with a Fault and a hovered cell',
    path: '/switches',
    before: markSwitchFault,
    prep: async (page) => {
      await page.locator('table.matrix a[data-cell="11"]').first().hover();
      await expect(page.locator('table.matrix th.hi').first()).toBeVisible();
    },
  },
  { name: 'lamp matrix', path: '/lamps' },
  {
    // Switches 32 and 33 marked Fault, so on desktop the parts list's selected row and one other
    // row carry a Fault pill, and the pointer rests on the other row: its pill sits on the hover
    // --sunk, not on the list's --cell. (The list renders no OK or Not tested pill.)
    name: 'map with switches 32 and 33 marked Fault, 32 selected and 33 hovered',
    path: '/map?layer=sw&id=32',
    before: async (page) => {
      await markSwitchFault(page);
      await markSwitchFault(page, 33);
    },
    prep: async (page) => {
      await expect(page.locator('.marker.sel')).toBeVisible();
      if (test.info().project.use.isMobile) return;
      await expect(page.locator('.rows .row.sel .pill.fault')).toBeVisible();
      const other = page
        .locator('.rows .row:not(.sel)')
        .filter({ has: page.locator('.pill.fault') });
      await expect(other).toHaveCount(1);
      await other.hover();
      const sunk = await page.evaluate(() => {
        const probe = document.createElement('i');
        probe.style.backgroundColor = 'var(--sunk)';
        document.body.append(probe);
        const c = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return c;
      });
      // eslint-disable-next-line playwright/no-standalone-expect -- runs inside the route's test
      await expect(other).toHaveCSS('background-color', sunk);
    },
  },
  { name: 'Handbook', path: '/handbook' },
  { name: 'Handbook section', path: '/handbook/rules' },
  {
    name: 'manual search',
    path: '/manual?q=flipper',
    prep: async (page) => {
      await expect(page.locator('.where').first()).toBeVisible();
    },
  },
  { name: 'manual page', path: '/manual/ops/25' },
  { name: 'parts', path: '/parts' },
  { name: 'Workshop', path: '/workshop' },
  {
    name: 'install sheet',
    path: '/workshop',
    prep: async (page) => {
      await page.getByText('Install the app').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  { name: 'setup', path: '/setup' },
  { name: 'shopping list', path: '/shopping', before: tickFaultLamp },
];

for (const route of ROUTES) {
  for (const mode of MODES) {
    test(`${route.name}: text, placeholders and rings meet AA (${mode === 'scheme' ? 'scheme' : 'other theme'})`, async ({
      page,
    }) => {
      await forceTheme(page, mode);
      if (route.before) await route.before(page);
      await gotoHydrated(page, route.path);
      if (route.prep) await route.prep(page);
      await animationsDone(page);
      const m = await page.evaluate(measure, themeOf(mode) === 'light');
      // The theme under test is the one painted.
      expect(m.paper > 0.5, 'light paper').toBe(themeOf(mode) === 'light');
      expect(m.texts, 'text nodes measured').toBeGreaterThan(5);
      expect(m.fails).toEqual([]);
      // --amber is the ring colour; text takes --amber-ink (spec §12), even through a variable.
      expect(m.amberText).toEqual([]);
      // Both DMD surfaces are the DMD ink on the dark well, in both themes (spec §8.6).
      expect(m.dmd).toEqual([]);
      for (const k of m.primary) expect(k).toBeGreaterThanOrEqual(4.5);
    });
  }
}

/* ---- Print (DS-03) ---- */

const lumOf = (rgb: string) => {
  const [r = 0, g = 0, b = 0] = (rgb.match(/[\d.]+/g) ?? []).map(Number);
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
/** Contrast against white paper. */
const onWhite = (rgb: string) => 1.05 / (lumOf(rgb) + 0.05);

const HIDDEN = [
  'nav.shell',
  '.map-controls',
  '.srch',
  '.search',
  '.seg',
  'nav.rbar',
  '.ibtn',
  '.tlink',
  '.toast-host',
  '.top .lead',
  '.top .trail',
  '.dock',
  '.chip',
  '.acts',
  '.back',
  'nav.pn',
  '.hb .side',
  '.ptr',
  '.scrim',
  '.sheet.map',
  '.sheet.dialog',
  'button.lrow',
  '.pgno',
  '.no-print',
];

function printed(hidden: string[]) {
  const shown = (el: Element) => {
    const b = el.getBoundingClientRect();
    return (
      el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) &&
      b.width > 1 &&
      b.height > 1
    );
  };
  const probe = document.createElement('i');
  document.body.append(probe);
  const color = (token: string) => {
    probe.style.color = `var(${token})`;
    return getComputedStyle(probe).color;
  };
  const tokens = Object.fromEntries(
    [
      '--ink',
      '--raised',
      '--cell',
      '--bar',
      '--dmd-well',
      '--violet',
      '--warn',
      '--faint',
      '--brass-ink',
    ].map((t) => [t, color(t)]),
  );
  probe.remove();
  const root = getComputedStyle(document.documentElement);
  const header = document.querySelector('header.top');
  const ct = document.querySelector('.top h1.ct');
  const full = document.querySelector('.top h1.ct .full');
  const ctStyle = ct && getComputedStyle(ct);
  const lt = document.querySelector('.lt');
  const ltH1 = document.querySelector('.lt h1');
  return {
    tokens,
    shadow: root.getPropertyValue('--shadow-1').trim(),
    scanFilter: root.getPropertyValue('--scan-filter').trim(),
    body: [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color],
    visible: hidden.flatMap((sel) =>
      [...document.querySelectorAll(sel)].filter(shown).map(() => sel),
    ),
    header: header ? shown(header) : false,
    // A bar page prints the bar's h1 as a plain, wrapping title.
    bar: {
      shown: full ? shown(full) : false,
      opacity: ctStyle?.opacity,
      whiteSpace: ctStyle?.whiteSpace,
      fits: ct ? ct.scrollWidth <= ct.clientWidth + 1 : false,
      clip: full ? getComputedStyle(full).getPropertyValue('clip') : '',
    },
    // A large-title page prints its real h1, the one in main, not the bar's aria-hidden copy.
    large: {
      shown: ltH1 ? shown(ltH1) : false,
      opacity: ltH1 ? getComputedStyle(ltH1).opacity : '',
      fits: ltH1 ? ltH1.scrollWidth <= ltH1.clientWidth + 1 : false,
      clip: lt ? getComputedStyle(lt).getPropertyValue('clip') : '',
    },
    // The page title, once, and it is the page's h1: any title-looking element counts.
    titles: [...document.querySelectorAll('h1, .top .ct, .lt')]
      .filter(shown)
      .filter((e) => e.matches('h1') || !e.querySelector('h1'))
      .map((e) => ({
        h1: e.matches('h1'),
        ariaHidden: !!e.closest('[aria-hidden="true"]'),
        text: e.textContent?.trim() ?? '',
      })),
    scan: [...document.querySelectorAll('.sheet.scan')].map((e) => [
      shown(e),
      getComputedStyle(e).filter,
    ]),
    inks: [
      ...document.querySelectorAll('.prose > section > h2, .pg-bar .mono, .pg-bar .st-untested'),
    ]
      .slice(0, 12)
      .map((e) => [e.textContent?.trim().slice(0, 24) ?? '', getComputedStyle(e).color]),
  };
}

type PrintRoute = {
  path: string;
  h1: 'page' | 'bar' | 'large';
  /** Chrome shown on screen in both projects, so its print check is not vacuous. */
  present: string[];
  /** And per project. */
  phone?: string[];
  desktop?: string[];
  before?: (page: Page) => Promise<void>;
  prep?: (page: Page) => Promise<void>;
};
const PRINT: PrintRoute[] = [
  {
    path: '/shopping',
    h1: 'page',
    present: ['nav.shell', '.back', '.top .lead', '.acts', 'button.lrow', '.no-print'],
    before: tickFaultLamp,
  },
  { path: '/switch/32', h1: 'bar', present: ['.seg', '.back', 'nav.pn', 'button.lrow'] },
  { path: '/handbook', h1: 'large', present: ['.srch', '.search', '.seg'] },
  {
    path: '/handbook/rules',
    h1: 'page',
    present: ['nav.rbar', '.ibtn', '.hb .side', '.back', '.map-controls'],
  },
  {
    path: '/manual/ops/25',
    h1: 'bar',
    present: ['.srch', '.search', '.seg', '.ibtn', '.back', '.pgno'],
  },
  { path: '/?q=32', h1: 'large', present: ['.dock', '.acts', '.ibtn', '.tlink', '.seg'] },
  {
    path: '/workshop',
    h1: 'large',
    present: ['.seg', '.scrim', '.sheet.dialog'],
    prep: async (page) => {
      await page.getByText('Install the app').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    path: '/map?layer=sw&id=32',
    h1: 'bar',
    present: ['.map-controls', '.ibtn'],
    phone: ['.sheet.map'],
    desktop: ['.acts'],
  },
];

for (const route of PRINT) {
  const { path, h1 } = route;
  for (const mode of MODES) {
    test(`print ${path}: black on white, no chrome, the title once (${mode === 'scheme' ? 'scheme' : 'other theme'})`, async ({
      page,
    }) => {
      await forceTheme(page, mode);
      if (route.before) await route.before(page);
      await gotoHydrated(page, path);
      if (route.prep) await route.prep(page);
      await animationsDone(page);
      const screen = await page.evaluate(printed, HIDDEN);
      const phone = test.info().project.use.isMobile === true;
      expect(screen.visible).toEqual(
        expect.arrayContaining([
          ...route.present,
          ...((phone ? route.phone : route.desktop) ?? []),
        ]),
      );
      await page.emulateMedia({ media: 'print' });
      const p = await page.evaluate(printed, HIDDEN);

      expect(p.tokens['--ink']).toBe('rgb(0, 0, 0)');
      for (const t of ['--raised', '--cell', '--bar', '--dmd-well'])
        expect(p.tokens[t], t).toBe('rgb(255, 255, 255)');
      for (const t of ['--violet', '--warn', '--faint', '--brass-ink'])
        expect(onWhite(p.tokens[t] ?? ''), t).toBeGreaterThanOrEqual(4.5);
      expect(p.shadow).toBe('none');
      expect(p.scanFilter).toBe('none');
      expect(p.body).toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)']);
      expect(p.visible).toEqual([]);

      // Only a bar page keeps the header: it holds that page's h1.
      expect(p.header).toBe(h1 === 'bar');
      if (h1 === 'bar') {
        expect(p.bar).toEqual({
          shown: true,
          opacity: '1',
          whiteSpace: 'normal',
          fits: true,
          clip: 'auto',
        });
      }
      if (h1 === 'large') {
        expect(p.large).toEqual({ shown: true, opacity: '1', fits: true, clip: 'auto' });
      }
      expect(p.titles).toHaveLength(1);
      expect(p.titles[0]).toMatchObject({ h1: true, ariaHidden: false });
      expect(p.titles[0]?.text).not.toBe('');

      if (path === '/manual/ops/25') expect(p.scan).toEqual([[true, 'none']]);
      if (path === '/handbook/rules') {
        expect(p.inks.length).toBeGreaterThan(0);
        for (const [what, c] of p.inks) expect(onWhite(c ?? ''), what).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
}

for (const path of ['/switches', '/lamps']) {
  test(`print ${path}: the matrix fits an A4 page`, async ({ page }) => {
    // A4 is 210 mm; less Chrome's default 1 cm margins that is 190 mm, 718 CSS px.
    await page.setViewportSize({ width: 718, height: 1000 });
    await gotoHydrated(page, path);
    await page.emulateMedia({ media: 'print' });
    const m = await page.evaluate(() => {
      const table = document.querySelector('table.matrix');
      const wrap = table?.closest('.scroll-x');
      const nm = table?.querySelector('.nm');
      return {
        page: document.documentElement.scrollWidth,
        right: table ? Math.round(table.getBoundingClientRect().right) : Infinity,
        clipped: wrap ? wrap.scrollWidth - wrap.clientWidth : Infinity,
        // A cell whose content is wider than the cell is cut off on paper.
        overflowing: table
          ? [...table.querySelectorAll('th, td a, td .empty')]
              .filter((c) => c.scrollWidth > c.clientWidth + 1)
              .map((c) => c.textContent?.trim().slice(0, 24) ?? '')
          : ['no table'],
        name: nm ? parseFloat(getComputedStyle(nm).fontSize) : 0,
        // A header pin wraps between its codes, never inside one (U18-11 at its hyphen).
        broken: table
          ? [...table.querySelectorAll('.pin')].flatMap((pin) => {
              const out: string[] = [];
              const walk = document.createTreeWalker(pin, NodeFilter.SHOW_TEXT);
              for (let n = walk.nextNode(); n; n = walk.nextNode())
                for (const w of n.textContent!.matchAll(/\S+/g)) {
                  const range = document.createRange();
                  range.setStart(n, w.index);
                  range.setEnd(n, w.index + w[0].length);
                  const tops = new Set(
                    [...range.getClientRects()]
                      .filter((b) => b.width > 0)
                      .map((b) => Math.round(b.top)),
                  );
                  if (tops.size > 1) out.push(w[0]);
                }
              return out;
            })
          : ['no table'],
      };
    });
    expect(m.page).toBeLessThanOrEqual(718);
    expect(m.right).toBeLessThanOrEqual(718);
    expect(m.clipped).toBeLessThanOrEqual(0);
    expect(m.overflowing).toEqual([]);
    expect(m.broken).toEqual([]);
    // Still readable.
    expect(m.name).toBeGreaterThanOrEqual(9);
  });
}

/* P1 item 5 of the app audit, round 3: paper keeps what the screen's controls hold and shows a
   table whole (CR3-01, CR3-04, CR3-05). A4 inside Chrome's default margins is 718 CSS px. */
test.describe('print keeps the values, the note and the whole table', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 718, height: 1000 });
  });

  test('/setup prints the suggested and the set values as text, no controls', async ({ page }) => {
    await gotoHydrated(page, '/setup');
    const field = page.locator('.vals input.field').first();
    await field.fill('17');
    await field.press('Tab');
    await page.emulateMedia({ media: 'print' });
    const rows = await page.locator('.vals').evaluateAll((els) =>
      els.map((el) => ({
        text: (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
        controls: [...el.querySelectorAll('button, input')].filter((c) => c.checkVisibility())
          .length,
      })),
    );
    expect(rows.length).toBeGreaterThan(30);
    for (const r of rows) {
      expect(r.controls, r.text).toBe(0);
      expect(r.text).toMatch(/^Suggested \S.* Set to/);
    }
    expect(rows[0]!.text).toMatch(/ Set to 17$/);
  });

  test('a component page prints its note as text, no controls', async ({ page }) => {
    await gotoHydrated(page, '/switch/32');
    const note = page.locator('.status input.note');
    await note.fill('Cleaned the contacts');
    await note.press('Tab');
    await page.emulateMedia({ media: 'print' });
    const status = page.locator('.status');
    await expect(status).toContainText('Note: Cleaned the contacts');
    const controls = await status
      .locator('button, input')
      .evaluateAll((els) => els.filter((c) => c.checkVisibility()).length);
    expect(controls).toBe(0);
  });

  for (const path of ['/coils', '/fuses', '/lamps', '/parts']) {
    test(`${path}: every table prints whole on an A4 page`, async ({ page }) => {
      await gotoHydrated(page, path);
      await page.emulateMedia({ media: 'print' });
      // Measured in the real faces: a fallback face is narrower.
      await page.evaluate(() => document.fonts.ready);
      const tables = await page.locator('.scroll-x').evaluateAll((els) =>
        els.map((el) => ({
          overflow: getComputedStyle(el).overflowX,
          right: Math.round(el.querySelector('table')?.getBoundingClientRect().right ?? 0),
          // A header cell past the page edge is a column the paper cuts (Location, Fault).
          cut: [...el.querySelectorAll('th')]
            .filter((th) => th.getBoundingClientRect().right > 718.5)
            .map((th) => th.textContent?.trim()),
        })),
      );
      expect(tables.length).toBeGreaterThan(0);
      for (const t of tables) {
        expect(t.overflow).toBe('visible');
        expect(t.right).toBeLessThanOrEqual(718);
        expect(t.cut).toEqual([]);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(718);
    });
  }
});
