import { expect, test, type Page } from '@playwright/test';
import { barCovered, gotoHydrated, twoFrames } from './helpers';

/*
 * P2 item 5 of the app audit: accessibility (AY-01, AY-02, AY-05, AY-06, AY-07, AY-09, AY-10,
 * AY-11, AY-12, AY-14, AY-15, FIELD-3-1). The rules live in spec §7.5 (map keys), §9.6 (matrix),
 * §9.12 (viewer) and §12 (skip link, links, live regions, 44 targets, focus under the bars).
 */

type Kit = {
  /** A short description of an element for failure messages. */
  describe: (e: Element) => string;
  /** An inline link (spec §12): its parent is running text that says more than the link does. */
  inline: (e: Element) => boolean;
  /** The element itself, or one of its labels, is at this point. */
  owns: (el: Element, x: number, y: number) => boolean;
  /** Contrast of two CSS colours, the first composited over the second (any colour syntax). */
  contrast: (fg: string, bg: string) => number;
};
type KitWindow = Window & { __a11y: Kit; __walked?: WeakSet<Element> };

/** Installed before the page's own scripts, so every page.evaluate below can reach it. */
function installKit() {
  const describe = (e: Element) =>
    e.tagName.toLowerCase() +
    (e.id ? '#' + e.id : '') +
    [...e.classList]
      .filter((c) => !c.startsWith('svelte-'))
      .map((c) => '.' + c)
      .join('') +
    (e.getAttribute('aria-label') ? '[' + e.getAttribute('aria-label') + ']' : '') +
    ' "' +
    (e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30) +
    '"';
  /* Running text (WCAG 2.5.8's inline exception): the link sits in a sentence, so its parent's own
     words, its links and buttons aside, run to three or more. A link in a nav (the tab bar), a
     heading or a .links list is a control, never inline: "13 on p. 2-39" or "Appendices: A3 …" is
     a label, not a sentence. */
  const inline = (el: Element) => {
    const p = el.parentElement;
    if (!p || el.closest('nav, h1, h2, h3, h4, h5, h6, .links')) return false;
    if (!p.matches('p, li, td, dd, .why, .owner-note, .ctext')) return false;
    let own = p.textContent ?? '';
    for (const c of p.querySelectorAll('a, button')) own = own.replace(c.textContent ?? '', ' ');
    return (own.match(/\p{L}{2,}/gu) ?? []).length >= 3;
  };
  const owns = (el: Element, x: number, y: number) => {
    const h = document.elementFromPoint(x, y);
    const labels = [...((el as HTMLInputElement).labels ?? [])];
    return !!h && (el.contains(h) || labels.some((l) => l.contains(h)));
  };
  const contrast = (fg: string, bg: string) => {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    const px = (...cs: string[]) => {
      x.clearRect(0, 0, 1, 1);
      x.fillStyle = '#fff';
      x.fillRect(0, 0, 1, 1);
      for (const k of cs) {
        x.fillStyle = k;
        x.fillRect(0, 0, 1, 1);
      }
      return [...x.getImageData(0, 0, 1, 1).data];
    };
    const L = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const a = L(px(bg, fg));
    const b = L(px(bg));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  (window as unknown as KitWindow).__a11y = { describe, inline, owns, contrast };
}

test.beforeEach(({ page }) => page.addInitScript(installKit));

type Seen = { desc: string; inView: boolean; uncovered: boolean; cover: string; again: boolean };

/** The focused element: inside the viewport, and what sits on top of its centre. */
const focused = (page: Page) =>
  page.evaluate((): Seen | null => {
    const w = window as unknown as KitWindow;
    const k = w.__a11y;
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    w.__walked ??= new WeakSet();
    const again = w.__walked.has(el);
    w.__walked.add(el);
    const r = el.getBoundingClientRect();
    const inView =
      r.width > 0 &&
      r.top >= -1 &&
      r.left >= -1 &&
      r.bottom <= innerHeight + 1 &&
      r.right <= innerWidth + 1;
    // A link that wraps has its box centre between its two lines: test its first line instead.
    const f = [...el.getClientRects()].find((b) => b.width > 0) ?? r;
    const x = f.left + f.width / 2;
    const y = f.top + f.height / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      desc: k.describe(el),
      inView,
      uncovered: k.owns(el, x, y),
      cover: hit ? k.describe(hit) : 'nothing',
      again,
    };
  });

/** Set by replacePage as a page turn starts, before the address changes. */
const leaving = (page: Page) => page.evaluate(() => document.documentElement.dataset.leave);

/** Looked at twice: the browser may still be finishing a focus scroll. */
async function settled(page: Page) {
  let s = await focused(page);
  if (s && (!s.inView || !s.uncovered)) {
    // Until the focused element holds still for two frames (the focus scroll has ended).
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<boolean>((done) => {
              const at = () => {
                const r = document.activeElement?.getBoundingClientRect();
                return r ? `${r.left},${r.top}` : '';
              };
              const a = at();
              requestAnimationFrame(() => requestAnimationFrame(() => done(at() === a)));
            }),
        ),
      )
      .toBe(true);
    await page.evaluate(() =>
      (window as unknown as KitWindow).__walked?.delete(document.activeElement!),
    );
    s = await focused(page);
  }
  return s;
}

/** Tabs through the page once; returns every stop that is off screen or under something. */
async function tabWalk(page: Page, max = 400) {
  const bad: string[] = [];
  let stops = 0;
  for (; stops < max; stops++) {
    await page.keyboard.press('Tab');
    const s = await settled(page);
    if (!s || s.again) break;
    if (!s.inView) bad.push(`${s.desc}: not inside the viewport`);
    else if (!s.uncovered) bad.push(`${s.desc}: under ${s.cover}`);
  }
  return { bad, stops };
}

test.describe('map keyboard model (AY-01, spec §7.5)', () => {
  test('skip link, drawing, arrows, Enter, Esc; markers are not tab stops', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      "WebKit's Tab skips links (Safari's default), so the tab order cannot be walked",
    );
    await gotoHydrated(page, '/map');
    const scroller = page.locator('.scroller');
    await expect(page.locator('button.marker').first()).toBeAttached();
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip')).toBeFocused();
    await page.keyboard.press('Enter');
    let n = 0;
    while (n < 5 && !(await scroller.evaluate((el) => el === document.activeElement))) {
      await page.keyboard.press('Tab');
      n++;
    }
    await expect(scroller, 'the drawing within 5 stops of the skip link').toBeFocused();
    let next = '';
    for (let i = 0; i < 2 && !next; i++) {
      await page.keyboard.press('Tab');
      next = await page.evaluate(() => {
        const a = document.activeElement;
        return a && a !== document.body && !a.classList.contains('marker') ? a.tagName : '';
      });
    }
    expect(next, 'the first control after the drawing within 2 stops').not.toBe('');
    await expect(page.locator('button.marker:not([tabindex="-1"])')).toHaveCount(0);

    // An arrow from the drawing focuses a marker; Enter selects and moves focus to the selection.
    await scroller.focus();
    await page.keyboard.press('ArrowRight');
    const marker = page.locator('button.marker:focus');
    await expect(marker).toHaveAttribute('aria-label', /^(Switch|Lamp|Solenoid|Shot) /);
    const key = await marker.getAttribute('data-key');
    const id = /^(?:Switch|Lamp|Solenoid|Shot) (\S+?),/.exec(
      (await marker.getAttribute('aria-label'))!,
    )![1]!;
    await page.keyboard.press('Enter');
    const sel = page.locator('[aria-label^="Selected component, "]:focus');
    await expect(sel).toHaveCount(1);
    await expect(sel).toContainText(id);

    // Esc deselects and hands focus back to the part's marker.
    await page.keyboard.press('Escape');
    await expect(page.locator('[aria-label^="Selected component, "]')).toHaveCount(0);
    await expect(page.locator('button.marker:focus')).toHaveAttribute('data-key', key!);
  });

  test('a click does not move focus; the first arrow goes to the selected part', async ({
    page,
  }) => {
    await gotoHydrated(page, '/map');
    const markers = page.locator('button.marker');
    await expect(markers.first()).toBeAttached();
    const pick = markers.nth(Math.floor((await markers.count()) / 2));
    await pick.click();
    await expect(pick).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[aria-label^="Selected component, "]:focus')).toHaveCount(0);
    const key = await pick.getAttribute('data-key');
    await page.locator('.scroller').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('button.marker:focus')).toHaveAttribute('data-key', key!);
  });

  test('a clicked Deselect hands focus back without panning the drawing', async ({ page }) => {
    await page.clock.install();
    await gotoHydrated(page, '/map');
    const scroller = page.locator('.scroller');
    await expect(page.locator('button.marker').first()).toBeAttached();
    await scroller.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('+');
    await expect
      .poll(() => scroller.evaluate((el) => el.scrollHeight > el.clientHeight * 1.5))
      .toBe(true);
    await page.keyboard.press('ArrowRight');
    const key = (await page.locator('button.marker:focus').getAttribute('data-key'))!;
    await page.keyboard.press('Enter');
    await expect(page.locator('[aria-label^="Selected component, "]:focus')).toHaveCount(1);
    /** The marker lies outside the drawing's visible box. */
    const away = () =>
      scroller.evaluate((el, k) => {
        const m = el.querySelector(`button.marker[data-key="${k}"]`)!.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return m.right < r.left || m.left > r.right || m.bottom < r.top || m.top > r.bottom;
      }, key);
    // Pan the marker out of view, as a reader does before closing the card.
    await scroller.evaluate((el, k) => {
      const m = el.querySelector(`button.marker[data-key="${k}"]`)!.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const y = m.top - r.top + el.scrollTop;
      el.scrollTop = y < el.scrollHeight / 2 ? el.scrollHeight : 0;
    }, key);
    expect(await away()).toBe(true);
    await page.getByRole('button', { name: 'Deselect' }).click();
    await expect(page.locator('[aria-label^="Selected component, "]')).toHaveCount(0);
    await expect(page.locator('button.marker:focus')).toHaveAttribute('data-key', key);
    // The focus (and any scroll it makes) has happened; a deferred one (a frame or a timer within
    // 200 ms, on the fake clock) would show here.
    await page.clock.runFor(200);
    expect(await away()).toBe(true);
  });

  test('calibration markers are tab stops and arrows nudge without moving focus', async ({
    page,
  }) => {
    await gotoHydrated(page, '/map?calib=1');
    await expect(page.locator('.card.calib')).toBeVisible();
    const markers = page.locator('button.marker');
    await expect(markers.first()).toBeAttached();
    await expect(page.locator('button.marker[tabindex="-1"]')).toHaveCount(0);
    const m = page.locator('button.marker[tabindex="0"]').first();
    const x = Number(await m.getAttribute('data-x'));
    await m.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(await m.getAttribute('data-x'))).toBeGreaterThan(x);
    await expect(m).toBeFocused();
  });

  test('in the handbook embed, Enter keeps focus on the marker', async ({ page }) => {
    await gotoHydrated(page, '/handbook/rules');
    const embed = page.locator('#pg-9 .shot-map');
    await embed.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        embed.locator('.canvas').evaluate((el) => (el as HTMLElement).style.width.endsWith('px')),
      )
      .toBe(true);
    await embed.locator('.scroller').focus();
    await page.keyboard.press('ArrowRight');
    const m = embed.locator('button.marker:focus');
    await expect(m).toHaveCount(1);
    const key = await m.getAttribute('data-key');
    await page.keyboard.press('Enter');
    await expect(embed.locator(`button.marker[data-key="${key}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(embed.locator('button.marker:focus')).toHaveAttribute('data-key', key!);
  });
});

/** The desktop panel is always there; the phone sheet only while a part is selected. */
const isWide = (page: Page) => page.evaluate(() => innerWidth >= 960);

test.describe('focus is never under a bar (AY-02)', () => {
  for (const url of ['/', '/?q=flipper', '/setup', '/shopping']) {
    test(`every tab stop on ${url} is on screen and uncovered`, async ({ page, browserName }) => {
      // /shopping's stops are links, which WebKit's Tab skips (Safari's default).
      test.skip(
        browserName === 'webkit' && url === '/shopping',
        "WebKit's Tab skips links (Safari's default), so the tab order cannot be walked",
      );
      test.setTimeout(180_000);
      await gotoHydrated(page, url);
      const { bad, stops } = await tabWalk(page);
      expect(stops).toBeGreaterThan(5);
      expect(bad).toEqual([]);
    });
  }

  test('every matrix cell on /switches is uncovered as the arrows reach it', async ({ page }) => {
    await gotoHydrated(page, '/switches');
    const start = page.locator('table.matrix [tabindex="0"]').first();
    await start.focus();
    const rows = await page.locator('table.matrix tbody tr').count();
    const cols = await page.locator('table.matrix tbody tr').first().locator('td').count();
    const bad: string[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const s = await settled(page);
        if (s && (!s.inView || !s.uncovered)) bad.push(`${s.desc}: under ${s.cover}`);
        if (c < cols - 1) await page.keyboard.press(r % 2 ? 'ArrowLeft' : 'ArrowRight');
      }
      await page.keyboard.press('ArrowDown');
    }
    expect(bad).toEqual([]);
  });
});

/** The focused element's ring, and every scroller or clipping box between it and the page that
 * cuts it: `a.tab "Map" <- nav.shell:left/right`. Null when the ring shows whole, or none is drawn
 * on the element itself (an invisible file input lends its ring to its row). */
function clippedRing(): string | null {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  if (cs.outlineStyle === 'none' || cs.opacity === '0') return null;
  const g = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth);
  const b = el.getBoundingClientRect();
  if (!b.width) return null;
  const ring = { l: b.left - g, t: b.top - g, r: b.right + g, b: b.bottom + g };
  const cut: string[] = [];
  const k = (window as unknown as KitWindow).__a11y;
  for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const s = getComputedStyle(a);
    const x = s.overflowX !== 'visible';
    const y = s.overflowY !== 'visible';
    const cv = s.contentVisibility === 'auto';
    if (!x && !y && !cv) continue;
    const q = a.getBoundingClientRect();
    const l = q.left + a.clientLeft;
    const t = q.top + a.clientTop;
    const sides = [
      (x || cv) && ring.l < l - 0.5 && 'left',
      (x || cv) && ring.r > l + a.clientWidth + 0.5 && 'right',
      (y || cv) && ring.t < t - 0.5 && 'top',
      (y || cv) && ring.b > t + a.clientHeight + 0.5 && 'bottom',
    ].filter(Boolean);
    if (sides.length) cut.push(`${k.describe(a).replace(/ ".*$/, '')}:${sides.join('/')}`);
  }
  return cut.length ? `${k.describe(el)} <- ${cut.join(', ')}` : null;
}

/** Tabs through the page once; every focused element whose ring a box cuts. */
async function ringWalk(page: Page, max = 160) {
  const bad = new Set<string>();
  let first: string | null = null;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return '';
      const w = window as unknown as KitWindow;
      return w.__a11y.describe(a) + (a.getBoundingClientRect().top + scrollY).toFixed(0);
    });
    if (!at || at === first) break;
    first ??= at;
    await twoFrames(page);
    const c = await page.evaluate(clippedRing);
    if (c) bad.add(c);
  }
  return [...bad];
}

test.describe('focus rings and reading order (P2 item 7 of the app audit, round 2)', () => {
  const RINGS: [string, boolean][] = [
    ['/workshop', false],
    ['/?q=flipper', false],
    // MapParts: the desktop panel's part list.
    ['/map', true],
  ];
  for (const [url, wide] of RINGS) {
    test(`no box cuts a focus ring on ${url} (AY2-02, AY2-03)`, async ({ page }) => {
      test.setTimeout(180_000);
      const widths = test.info().project.use.isMobile ? [0] : [0, 1024];
      for (const w of widths) {
        if (w) await page.setViewportSize({ width: w, height: 800 });
        await gotoHydrated(page, url);
        if (wide && !(await isWide(page))) continue;
        expect(await ringWalk(page), `at ${w || 'the project width'}`).toEqual([]);
      }
    });
  }

  test('the DOM reads header, main, then the tab bar (AY2-04)', async ({ page, browserName }) => {
    await gotoHydrated(page, '/coils');
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('body > header.top, body > main, body > nav.shell')].map((e) =>
        e.tagName.toLowerCase(),
      ),
    );
    expect(order).toEqual(['header', 'main', 'nav']);
    // The skip link stays the first stop (WebKit's Tab skips links, Safari's default).
    if (browserName === 'webkit') return;
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip')).toBeFocused();
  });

  test('a dimmed marker keeps a 3:1 ring beside the selected one (AY2-05)', async ({ page }) => {
    await gotoHydrated(page, '/map?layer=sw&id=32');
    await expect(page.locator('.canvas.has-sel .marker.sel')).toBeVisible();
    const rings = await page.locator('.canvas.has-sel .marker:not(.sel)').evaluateAll((els) => {
      const k = (window as unknown as KitWindow).__a11y;
      return els.slice(0, 12).map((el) => {
        let alpha = 1;
        for (let e: Element | null = el; e; e = e.parentElement)
          alpha *= parseFloat(getComputedStyle(e).opacity);
        const ring = /^(rgba?\([^)]*\))[^,]*\binset\b/.exec(getComputedStyle(el).boxShadow)?.[1];
        let bg = 'rgb(255, 255, 255)';
        for (let e = el.parentElement; e; e = e.parentElement) {
          const c = getComputedStyle(e).backgroundColor;
          if (c && !/rgba\(.*,\s*0\)$/.test(c) && c !== 'transparent') {
            bg = c;
            break;
          }
        }
        return { key: el.getAttribute('data-key'), alpha, ratio: ring ? k.contrast(ring, bg) : 0 };
      });
    });
    expect(rings.length).toBeGreaterThan(5);
    for (const r of rings) {
      expect(r.alpha, `${r.key} fades only its fill`).toBe(1);
      expect(r.ratio, `${r.key} ring`).toBeGreaterThanOrEqual(3);
    }
  });
});

test('the rules embed passes beneath the top bar, never over its buttons (AY2-01)', async ({
  page,
}) => {
  await gotoHydrated(page, '/handbook/rules');
  const embed = page.locator('#pg-9 .shot-map');
  await embed.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      embed.locator('.canvas').evaluate((el) => (el as HTMLElement).style.width.endsWith('px')),
    )
    .toBe(true);
  // From the embed's top at mid-screen until its bottom has passed under the bar, 32 px a step.
  const { from, to } = await embed.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { from: Math.max(0, scrollY + r.top - innerHeight / 2), to: scrollY + r.bottom };
  });
  let beneath = 0;
  const bad: string[] = [];
  for (let y = from; y <= to; y += 32) {
    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y);
    await twoFrames(page);
    const under = await embed.evaluate((el) => {
      const b = document.querySelector('header.top')!.getBoundingClientRect();
      return [...el.querySelectorAll('.map-controls .glass')].some((g) => {
        const a = g.getBoundingClientRect();
        return a.top < b.bottom && a.bottom > b.top;
      });
    });
    if (under) beneath++;
    for (const name of await barCovered(page)) bad.push(`${name} at scrollY ${Math.round(y)}`);
  }
  expect(beneath, 'the controls passed the bar').toBeGreaterThan(0);
  expect(bad).toEqual([]);
});

test('the skip link is a 44 pill centred in the top bar (AY-05)', async ({ page, browserName }) => {
  test.skip(
    browserName === 'webkit',
    "WebKit's Tab skips links (Safari's default), so the tab order cannot be walked",
  );
  await gotoHydrated(page, '/');
  await page.keyboard.press('Tab');
  const skip = page.locator('a.skip');
  await expect(skip).toBeFocused();
  const g = await skip.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const bar = document.querySelector('header.top')!.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      r: { top: r.top, left: r.left, bottom: r.bottom, right: r.right, w: r.width, h: r.height },
      clip: cs.getPropertyValue('clip'),
      ring: cs.outlineStyle === 'none' ? null : cs.outlineColor,
      // How far the ring reaches past the pill: offset plus width (negative is inside it).
      grow: parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth),
      fill: cs.backgroundColor,
      want: bar.top + (bar.height - 44) / 2,
      vw: innerWidth,
      vh: innerHeight,
    };
  });
  expect(g.r.h).toBeGreaterThanOrEqual(43.5);
  expect(g.r.w).toBeGreaterThan(100);
  expect(g.r.top).toBeGreaterThanOrEqual(0);
  expect(g.r.left).toBeGreaterThanOrEqual(0);
  expect(g.r.bottom).toBeLessThanOrEqual(g.vh);
  expect(g.r.right).toBeLessThanOrEqual(g.vw);
  expect(g.clip).toBe('auto');
  expect(Math.abs(g.r.top - g.want)).toBeLessThanOrEqual(1);
  // The focus ring is whole: on the phone the pill fills the bar from the viewport's top edge,
  // where a ring outside it was cut off. It shows on the amber fill at 3:1.
  expect(g.ring).not.toBeNull();
  expect(g.r.top - g.grow).toBeGreaterThanOrEqual(0);
  expect(g.r.left - g.grow).toBeGreaterThanOrEqual(0);
  expect(g.r.bottom + g.grow).toBeLessThanOrEqual(g.vh);
  expect(g.r.right + g.grow).toBeLessThanOrEqual(g.vw);
  const ratio = await page.evaluate(
    ([fg, bg]) => (window as unknown as KitWindow).__a11y.contrast(fg!, bg!),
    [g.ring, g.fill],
  );
  expect(ratio).toBeGreaterThanOrEqual(3);
});

test.describe('links in running text are underlined (AY-06)', () => {
  for (const url of ['/switch/12', '/handbook/quick', '/handbook/rules', '/parts']) {
    test(url, async ({ page }) => {
      await gotoHydrated(page, url);
      const out = await page.evaluate(() => {
        const k = (window as unknown as KitWindow).__a11y;
        const line = (e: Element) => getComputedStyle(e).textDecorationLine.includes('underline');
        const links = [...document.querySelectorAll('a[href]')];
        return {
          inline: links.filter(k.inline).length,
          bare: links.filter((a) => k.inline(a) && !line(a)).map(k.describe),
          seg: [...document.querySelectorAll('.seg > a')].filter(line).map(k.describe),
        };
      });
      // The rules page has no link in running text (its links are the contents and the seg).
      if (url !== '/handbook/rules') expect(out.inline).toBeGreaterThan(0);
      expect(out.bare).toEqual([]);
      expect(out.seg).toEqual([]);
    });
  }
});

test('a matrix cell names its status and shows a mark (AY-07)', async ({ page }) => {
  for (const [id, st] of [
    ['12', 'OK'],
    ['13', 'Fault'],
    ['14', 'Not tested'],
    ['15', 'OK'],
  ] as const) {
    await gotoHydrated(page, `/switch/${id}`);
    await page.getByRole('button', { name: st, exact: true }).click();
    await expect(page.getByRole('button', { name: st, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }
  await gotoHydrated(page, '/switches');
  const cell = (id: string) => page.locator(`table.matrix a[href$="/switch/${id}"]`);
  await expect(cell('13')).toHaveAccessibleName('13 Start Button, Fault');
  await expect(cell('14')).toHaveAccessibleName('14 Plumb Bob Tilt, Not tested');
  await expect(cell('15')).toHaveAccessibleName('15 Left Trough, OK');
  for (const id of ['13', '14', '15']) {
    const inside = await cell(id).evaluate((a) => {
      const mk = a.querySelector('.mk');
      if (!mk) return false;
      const r = a.getBoundingClientRect();
      const m = mk.getBoundingClientRect();
      return (
        m.width >= 9 &&
        m.left >= r.left &&
        m.right <= r.right &&
        m.top >= r.top &&
        m.bottom <= r.bottom
      );
    });
    expect(inside, `the mark sits inside cell ${id}`).toBe(true);
  }
  // An unused position takes no status: no suffix and no mark.
  await expect(cell('12')).toHaveAccessibleName('12 Not Used');
  await expect(cell('12').locator('.mk')).toHaveCount(0);
});

type Surface = {
  name: string;
  url: string;
  open?: (page: Page) => Promise<void>;
  field: string;
  region: string;
  hit: [string, RegExp];
  miss: [string, RegExp];
  /** The /parts count line is a visible role=status that has always read its count. */
  quietOnLoad?: false;
};

const DIAG = 'textarea#codes';
const SURFACES: Surface[] = [
  {
    name: 'Diagnose search',
    url: '/',
    field: DIAG,
    region: 'section.diag > p[aria-live]',
    hit: ['flipper', /^\d+ results? for “flipper”$/],
    miss: ['qqzzx', /^No results match “qqzzx”\.$/],
  },
  {
    name: 'Diagnose codes',
    url: '/',
    field: DIAG,
    region: 'section.diag > p[aria-live]',
    hit: ['32 68', /switch/],
    miss: ['row 5', /^No codes recognised$/],
  },
  {
    name: 'parts',
    url: '/parts',
    field: 'input[aria-label="Search parts"]',
    region: '[role=status]',
    hit: ['flipper', /^\d+ rows?/],
    miss: ['qqzzx', /^No parts match “qqzzx”\.$/],
    quietOnLoad: false,
  },
  {
    name: 'manual',
    url: '/manual',
    field: 'input[aria-label="Search the manuals"]',
    region: '.msearch > p[aria-live]',
    hit: ['flipper', /^\d+ pages?$/],
    miss: ['qqzzx', /^No pages match “qqzzx”\.$/],
  },
  {
    name: 'tables',
    url: '/tables',
    field: 'input.search',
    region: 'p[data-live][aria-live]',
    hit: ['lamp', /^\d+ tables?$/],
    miss: ['qqzzx', /^No tables match “qqzzx”\.$/],
  },
  {
    name: 'map find',
    url: '/map',
    open: async (page) => {
      if (!(await isWide(page)))
        await page.getByRole('button', { name: 'All components on the map' }).click();
    },
    field: 'input[aria-label="Search components"]',
    region: '.map-ui > p[aria-live]',
    hit: ['jet', /^\d+ components match$/],
    miss: ['qqzzx', /^No components match “qqzzx”\.$/],
  },
  {
    name: 'handbook contents',
    url: '/handbook/tests',
    open: async (page) => {
      if (await isWide(page)) {
        const d = page.locator('aside.side details');
        if (!(await d.evaluate((el) => (el as HTMLDetailsElement).open)))
          await d.locator('summary').click();
      } else {
        await page
          .getByRole('navigation', { name: 'Reader' })
          .getByRole('button', { name: 'Contents' })
          .click();
      }
    },
    field: 'input[aria-label="Search the handbook"]',
    region: 'nav.toc > p[aria-live]',
    hit: ['switch', /^\d+ headings? match/],
    miss: ['qqzzx', /^No headings match “qqzzx”\.$/],
  },
];

test.describe('search results are announced (AY-09, spec §12)', () => {
  for (const s of SURFACES) {
    test(s.name, async ({ page }) => {
      await page.clock.install();
      await gotoHydrated(page, s.url);
      await s.open?.(page);
      const field = page.locator(s.field).filter({ visible: true }).first();
      const region = page.locator(s.region).filter({ visible: true }).first();
      await expect(field).toBeVisible();
      await expect(region).toHaveCount(1);
      if (s.quietOnLoad !== false) {
        // Past liveText's 400 ms delay (live.svelte.ts), on the fake clock: the region stays empty.
        await page.clock.runFor(450);
        await expect(region).toHaveText('');
      }
      await field.fill(s.hit[0]);
      await expect(region).toHaveText(s.hit[1]);
      await field.fill(s.miss[0]);
      await expect(region).toHaveText(s.miss[1]);
      await expect(page.locator('[role=status][aria-live]')).toHaveCount(0);
    });
  }

  test('a pre-filled ?q= is not announced', async ({ page }) => {
    await page.clock.install();
    await gotoHydrated(page, '/?q=flipper');
    // Past liveText's 400 ms delay (live.svelte.ts), on the fake clock: the region stays empty.
    await page.clock.runFor(450);
    await expect(page.locator('section.diag > p[aria-live]')).toHaveText('');
    await gotoHydrated(page, '/manual?q=flipper');
    await page.clock.runFor(450);
    await expect(page.locator('.msearch > p[aria-live]')).toHaveText('');
  });

  test('a chip or a filter after a pre-filled ?q= is announced', async ({ page }) => {
    await page.clock.install();
    await gotoHydrated(page, '/?q=flipper');
    const region = page.locator('section.diag > p[aria-live]');
    // Every source has answered (the fetched ones too), so the chip below changes the results.
    await expect(page.locator('section.diag h3.lst-h')).toHaveCount(4);
    // Past liveText's 400 ms delay (live.svelte.ts), on the fake clock: the region stays empty.
    await page.clock.runFor(450);
    await expect(region).toHaveText('');
    await page.locator('button.chip', { hasText: 'Components' }).click();
    await expect(region).toHaveText(/^\d+ results? for “flipper”$/);
    // The manual's Document select is the same kind of action on the loaded query.
    await gotoHydrated(page, '/manual?q=flipper');
    const pages = page.locator('.msearch > p[aria-live]');
    await expect(page.locator('.msearch > p.muted.small')).toHaveText(/^\d+ pages?$/);
    await page.clock.runFor(450);
    await expect(pages).toHaveText('');
    await page.getByRole('combobox', { name: 'Document' }).selectOption('hb');
    await expect(pages).toHaveText(/^\d+ pages?$/);
  });

  test('one manual page is "1 page"', async ({ page }) => {
    await gotoHydrated(page, '/manual');
    await page.locator('input[aria-label="Search the manuals"]').fill('intelligence');
    await expect(page.locator('.msearch > p[aria-live]')).toHaveText('1 page');
  });

  for (const [url, n] of [
    ['/care', 1],
    ['/setup', 1],
    ['/shopping', 1],
    ['/workshop', 0],
  ] as const) {
    test(`${url} has ${n} role=status and none with aria-live`, async ({ page }) => {
      await gotoHydrated(page, url);
      await expect(page.locator('[role=status]')).toHaveCount(n);
      await expect(page.locator('[role=status][aria-live]')).toHaveCount(0);
    });
  }
});

test('setup controls have unique names (AY-10)', async ({ page }) => {
  await gotoHydrated(page, '/setup');
  const snap = await page.locator('ol.steps').ariaSnapshot();
  // A YAML line whose name holds ": " comes single-quoted: - 'checkbox "Done: …"'
  const lines = snap.split('\n').map((l) => {
    const t = l.trim().replace(/^- /, '');
    return t.startsWith("'") ? t.replace(/^'(.*)':?$/, '$1').replace(/''/g, "'") : t;
  });
  const names = (role: string) =>
    lines
      .map((l) => new RegExp(`^${role} "((?:[^"\\\\]|\\\\.)*)"`).exec(l))
      .filter((m) => m !== null)
      .map((m) => m[1]!.replace(/\\"/g, '"'));
  const unique = (list: string[]) => expect(new Set(list).size, list.join(' | ')).toBe(list.length);

  const fields = names('textbox');
  expect(fields).toHaveLength(await page.locator('.set input.field').count());
  expect(fields.length).toBe(38);
  for (const n of fields) expect(n).toMatch(/^Set to .+/);
  unique(fields);

  const suggest = names('button').filter((n) => n.includes(', suggested for '));
  expect(suggest.length).toBe(await page.locator('.vals > button').count());
  for (const n of suggest) expect(n).toMatch(/^.+, suggested for .+$/);
  unique(suggest);

  const links = names('link');
  expect(links.length).toBeGreaterThan(0);
  for (const n of links) expect(n).toMatch(/ in the handbook$/);
  unique(links);

  const done = names('checkbox');
  expect(done.length).toBeGreaterThan(0);
  for (const n of done) expect(n).toMatch(/^Done: /);
  unique(done);

  const custom = fields.filter((n) => /Custom Message/i.test(n));
  expect(custom.length).toBe(2);
  unique(custom);
});

test.describe('page viewer keys (AY-11, spec §9.12)', () => {
  test('a disabled end is a link that is not a tab stop', async ({ page }) => {
    for (const [url, name] of [
      ['/manual/ops/1', 'Previous page'],
      ['/manual/ops/124', 'Next page'],
    ] as const) {
      await gotoHydrated(page, url);
      const end = page.locator(`.viewer .tb a[aria-label="${name}"]`);
      await expect(end).toHaveAttribute('role', 'link');
      await expect(end).toHaveAttribute('aria-disabled', 'true');
      await expect(end).not.toHaveAttribute('href');
      expect(await end.evaluate((el) => (el.focus(), document.activeElement === el))).toBe(false);
    }
  });

  test('the zoomed stage is a named stop the arrows scroll; modified keys do nothing', async ({
    page,
  }) => {
    await gotoHydrated(page, '/manual/ops/5');
    const url = page.url();
    const titles = await page
      .locator('.viewer [title]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('title')!));
    expect(titles).toHaveLength(8);
    for (const t of titles) expect(t).toMatch(/\(.+\)$/);
    // 0 returns to the fit in force, so the pressed fit button names it, and only that one.
    const fits = page.locator('.viewer button.fit');
    await expect(fits.and(page.locator('[aria-pressed="true"]'))).toHaveAttribute(
      'title',
      /\(\w, 0\)$/,
    );
    await expect(fits.and(page.locator('[aria-pressed="false"]'))).toHaveAttribute(
      'title',
      /\(\w\)$/,
    );
    await page.keyboard.press('W');
    await expect(fits.and(page.locator('[aria-label="Fit width"]'))).toHaveAttribute(
      'title',
      'Fit width (W, 0)',
    );

    await page.keyboard.press('+');
    const stage = page.locator('.stage[tabindex="0"]');
    await expect(stage).toHaveCount(1);
    await expect(stage).toHaveAttribute('aria-label', /zoomed/);
    // Zoom until the stage overflows both ways, so the arrows have something to scroll; how many
    // steps that takes depends on the viewport (two were not enough at 390×844).
    for (let i = 0; i < 8; i++) {
      const over = await stage.evaluate(
        (el) => el.scrollHeight > el.clientHeight && el.scrollWidth > el.clientWidth,
      );
      if (over) break;
      await page.keyboard.press('+');
    }
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let i = 0; i < 30; i++) {
      if (await stage.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(stage).toBeFocused();
    const top = await stage.evaluate((el) => (el.scrollTop = 0));
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => stage.evaluate((el) => el.scrollTop)).toBeGreaterThan(top);
    expect(page.url()).toBe(url);
    // At the stage's edge the arrows stop: they never go on to scroll the page.
    const edge = await stage.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.scrollLeft = el.scrollWidth;
      return { top: el.scrollTop, left: el.scrollLeft, y: scrollY, x: scrollX };
    });
    for (const k of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowDown'])
      await page.keyboard.press(k);
    // The key handler is synchronous and a page turn marks itself at once (replacePage).
    await twoFrames(page);
    expect(await leaving(page)).toBeUndefined();
    expect(
      await stage.evaluate((el) => ({
        top: el.scrollTop,
        left: el.scrollLeft,
        y: scrollY,
        x: scrollX,
      })),
    ).toEqual(edge);
    expect(page.url()).toBe(url);

    const width = () => stage.evaluate((el) => el.scrollWidth);
    const w = await width();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    for (const k of ['Alt+ArrowRight', 'Control+ArrowRight', 'Control+Equal', 'Meta+ArrowRight']) {
      await page.keyboard.press(k);
    }
    await twoFrames(page);
    expect(await leaving(page)).toBeUndefined();
    expect(page.url()).toBe(url);
    expect(await width()).toBe(w);

    // Keys typed in the go-to field stay in it.
    await page.locator('.viewer .pgno').click();
    const go = page.locator('#goto-page');
    await expect(go).toBeFocused();
    for (const k of ['ArrowRight', 'r', 't', '+', '0']) await page.keyboard.press(k);
    await twoFrames(page);
    expect(await leaving(page)).toBeUndefined();
    expect(page.url()).toBe(url);
    expect(await width()).toBe(w);
  });
});

test.describe('targets are 44 or carved out (AY-12, spec §12)', () => {
  for (const url of [
    '/',
    '/?q=flipper',
    '/?q=12%2013',
    '/switches',
    '/switch/12',
    '/coil/01',
    '/lamp/11',
    '/lamps',
    '/coils',
    '/fuses',
    '/verify',
    '/handbook',
    '/handbook/quick',
    '/handbook/menus',
    '/handbook/rules',
    '/handbook/appendix',
    '/manual',
    '/manual/ops/5',
    '/parts',
    '/tables',
    '/workshop',
    '/setup',
    '/shopping',
    '/care',
    '/map',
    '/404',
  ]) {
    test(url, async ({ page, isMobile }) => {
      test.setTimeout(120_000);
      await gotoHydrated(page, url);
      // The fonts and the first layout, before measuring.
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await twoFrames(page);
      const out = await page.evaluate(
        ([phone]) => {
          const k = (window as unknown as KitWindow).__a11y;
          const SEL =
            'a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex="0"]';
          const fails: string[] = [];
          let checked = 0;
          for (const el of document.querySelectorAll<HTMLElement>(SEL)) {
            if (!el.checkVisibility({ visibilityProperty: true })) continue;
            if (el.closest('.sr-only')) continue; // the skip link, until focused (its own test)
            el.scrollIntoView({ block: 'center', inline: 'center' });
            const r = el.getBoundingClientRect();
            if (r.width < 2 && r.height < 2) continue;
            checked++;
            if (r.width >= 43.5 && r.height >= 43.5) continue;
            // A label is part of its control's target: a 22 checkbox in a 44 label.tick passes.
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const big = (b: DOMRect) =>
              b.width >= 43.5 &&
              b.height >= 43.5 &&
              b.left <= cx &&
              cx <= b.right &&
              b.top <= cy &&
              cy <= b.bottom;
            const labels = [...((el as HTMLInputElement).labels ?? [])];
            if (labels.some((l) => l.contains(el) && big(l.getBoundingClientRect()))) continue;
            // Otherwise rect ∪ ::after: a 44 box round it hits it at all four corners. The box is
            // centred on it, or flush with one of its edges (a key-column id link starts at its
            // table scroller's clipping edge, so its box runs right from it).
            const box = (x: number, y: number) =>
              [x + 0.5, x + 43.5].every((px) =>
                [y + 0.5, y + 43.5].every((py) => k.owns(el, px, py)),
              );
            const xs = [cx - 22, r.left, r.right - 44];
            const ys = [cy - 22, r.top, r.bottom - 44];
            if (xs.some((x) => ys.some((y) => box(x, y)))) continue;
            // The allow-list (spec §12), asserted exhaustively: every other miss fails. A link in a
            // handbook table (a page ref, "1-2, 3" in a 33-tall row, or "see A6 Flippers") meets
            // WCAG 2.5.8 instead: 24 wide at least, and no other target in its table has a centre
            // nearer than 24.
            const spaced = () =>
              r.width >= 23.5 &&
              [...el.closest('table')!.querySelectorAll<HTMLElement>(SEL)].every((o) => {
                if (o === el || !o.checkVisibility()) return true;
                const b = o.getBoundingClientRect();
                return Math.hypot(b.left + b.width / 2 - cx, b.top + b.height / 2 - cy) >= 24;
              });
            const allowed =
              el.matches('button.marker') ||
              (el.matches('a[href]') && k.inline(el)) ||
              (el.matches('.prose td > a[href]') && spaced()) ||
              (phone && el.matches('table.matrix td a') && r.height >= 43.5);
            if (!allowed)
              fails.push(`${k.describe(el)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
          }
          scrollTo(0, 0);
          return { checked, fails };
        },
        [isMobile] as const,
      );
      expect(out.checked).toBeGreaterThan(3);
      expect(out.fails).toEqual([]);
    });
  }
});

test.describe('handbook headings and the owner note (AY-14)', () => {
  for (const url of ['/handbook/quick', '/handbook/rules']) {
    test(url, async ({ page }) => {
      await gotoHydrated(page, url);
      const levels = await page
        .locator('h1, h2, h3, h4, h5, h6')
        .evaluateAll((hs) =>
          hs
            .filter((h) => h.checkVisibility())
            .map((h) => ({ level: Number(h.tagName[1]), text: h.textContent?.trim() })),
        );
      expect(levels.filter((h) => h.level === 1)).toHaveLength(1);
      const skips = levels.filter((h, i) => i > 0 && h.level > levels[i - 1]!.level + 1);
      expect(skips).toEqual([]);
      const notes = page.locator('.owner-note');
      if (url === '/handbook/quick') expect(await notes.count()).toBeGreaterThan(0);
      for (const note of await notes.all()) {
        await expect(note).toHaveAttribute('role', 'note');
        await expect(note).toHaveAccessibleName("Owner's note");
      }
    });
  }

  test('the rules embed keeps its own heading face', async ({ page }) => {
    await gotoHydrated(page, '/handbook/rules');
    const embed = page.locator('#pg-9 .shot-map');
    await embed.scrollIntoViewIfNeeded();
    const h = embed.locator('h2', { hasText: 'Playfield' }).first();
    await expect(h).toBeAttached();
    const s = await h.evaluate((el) => {
      const prose = document.querySelector('.prose > section > h2')!;
      return {
        matched: el.matches('.prose > section > h2, .prose > section > h3'),
        color: getComputedStyle(el).color,
        proseColor: getComputedStyle(prose).color,
      };
    });
    expect(s.matched).toBe(false);
    expect(s.color).not.toBe(s.proseColor);
  });
});

test.describe('fields keep a focus ring and a 3:1 edge (AY-15, FIELD-3-1)', () => {
  for (const [url, sel] of [
    ['/setup', '.set input.field'],
    ['/parts', 'input.search'],
  ] as const) {
    test(`${sel} on ${url}`, async ({ page }) => {
      await gotoHydrated(page, url);
      const f = page.locator(sel).first();
      const edge = await f.evaluate((el) => {
        const ratio = (window as unknown as KitWindow).__a11y.contrast;
        const cs = getComputedStyle(el);
        let bg = 'transparent';
        for (let e: Element | null = el; e; e = e.parentElement) {
          const c = getComputedStyle(e).backgroundColor;
          if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) {
            bg = c;
            break;
          }
        }
        const shadow = /^(.*?\))\s+0px 0px 0px 1px inset/.exec(cs.boxShadow)?.[1];
        const line = el.classList.contains('field') ? cs.borderTopColor : (shadow ?? '');
        return { line, bg, ratio: line ? ratio(line, bg) : 0 };
      });
      expect(edge.ratio, `${edge.line} on ${edge.bg}`).toBeGreaterThanOrEqual(3);

      await f.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(f).toBeFocused();
      const ring = await f.evaluate((el) => {
        const cs = getComputedStyle(el);
        const probe = document.createElement('i');
        probe.style.color = 'var(--amber)';
        document.body.append(probe);
        const amber = getComputedStyle(probe).color;
        probe.remove();
        return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor, amber };
      });
      expect(ring.style).toBe('solid');
      expect(ring.width).toBe('2px');
      expect(ring.color).toBe(ring.amber);
    });
  }
});

/* P3 item 1 of the app audit (spec §13): a link in running text keeps its spaces. Astro drops
 * the line break before an inline <a>, which glued "Source:" to its link. */
test.describe('inline-link spacing', () => {
  for (const path of ['/care', '/setup', '/shopping', '/switches', '/lamps', '/coils']) {
    test(`${path}: every link in running text has a space or punctuation each side`, async ({
      page,
    }) => {
      await gotoHydrated(page, path);
      const glued = await page.locator('main a').evaluateAll((links) =>
        links.flatMap((a) => {
          const block = a.parentElement?.closest('p, li, dd, td, figcaption');
          if (!block) return [];
          const r = document.createRange();
          r.selectNodeContents(block);
          r.setEndBefore(a);
          const before = r.toString().slice(-1);
          r.selectNodeContents(block);
          r.setStartAfter(a);
          const after = r.toString().slice(0, 1);
          const ok =
            (before === '' || /[\s(“‘"'/—–-]/.test(before)) &&
            (after === '' || /[\s.,;:!?)”’"'/—–-]/.test(after));
          return ok ? [] : [`${before}[${a.textContent?.trim()}]${after}`];
        }),
      );
      expect(glued).toEqual([]);
    });
  }
});
