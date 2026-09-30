import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';
import { TABS } from '~/lib/nav';
import { SECTIONS } from '~/lib/handbook/sections';

/* P2 item 1 of the app audit (VP-03, AY-13): the bar's `1fr auto 1fr` grid gave the title its
   width (up to 220) first and each side only what was left, 42 px at 320, so a nowrap back label
   such as "Handbook" (114 px) spilled over the title. Under 1280 each side now keeps 44 px, a label
   that does not fit its side wraps out of the 44 px link (the chevron stays), and the long
   Handbook sections and /fuses pass a short title. Paths are relative, so this also runs under a
   BASE_PATH. */

const routes = [
  ...new Set(TABS.flatMap((t) => [t.path, ...t.subs.map((s) => s.path.split('#')[0]!)])),
  ...SECTIONS.map((s) => `handbook/${s.key}`),
  'switch/32',
  'lamp/11',
  'coil/01',
  'manual/ops/2',
  '404',
].map((r) => r || './');

type Label = 'none' | 'whole' | 'hidden' | 'partial';
interface Bar {
  back: { left: number; right: number } | null;
  ct: { left: number; right: number };
  /** The left edge of the first visible trailing button, not of the `.trail` cell. */
  trail: number | null;
  ellipsis: boolean;
  label: Label;
  docWidth: number;
}

/** The bar's geometry once the fonts have loaded, with a tab root's large title scrolled away. */
const measure = (page: Page): Promise<Bar> =>
  page.evaluate(async () => {
    await document.fonts.ready;
    const top = document.querySelector<HTMLElement>('header.top')!;
    if (top.dataset.h1 === 'large') {
      window.scrollTo({ top: 200, behavior: 'instant' as ScrollBehavior });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    const back = top.querySelector<HTMLElement>('a.back');
    const span = back?.querySelector('span');
    const ct = top.querySelector<HTMLElement>('.ct')!;
    const buttons = [...top.querySelectorAll<HTMLElement>('.trail > *, .trail .ibtn')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0);
    const c = ct.getBoundingClientRect();
    let label: Label = 'none';
    if (back && span) {
      const b = back.getBoundingClientRect();
      const s = span.getBoundingClientRect();
      const inside =
        s.left >= b.left - 0.5 &&
        s.right <= b.right + 0.5 &&
        s.top >= b.top - 0.5 &&
        s.bottom <= b.bottom + 0.5;
      if (inside && span.scrollWidth <= span.clientWidth) label = 'whole';
      else if (s.top >= b.bottom - 0.5) label = 'hidden';
      else label = 'partial';
    }
    const b = back?.getBoundingClientRect();
    return {
      back: b ? { left: b.left, right: b.right } : null,
      ct: { left: c.left, right: c.right },
      trail: buttons.length ? Math.min(...buttons.map((r) => r.left)) : null,
      ellipsis: ct.scrollWidth > ct.clientWidth,
      label,
      docWidth: document.documentElement.scrollWidth,
    };
  });

test.describe('the phone bar: back label, title and actions never overlap', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone widths');

  for (const route of routes) {
    test(`${route} at 320, 360 and the project width`, async ({ page }) => {
      const widths = [...new Set([320, 360, page.viewportSize()!.width])];
      for (const width of widths) {
        await page.setViewportSize({ width, height: 800 });
        await gotoHydrated(page, route);
        const m = await measure(page);
        const at = `${route} at ${width}px`;
        if (m.back)
          expect(m.back.right, `${at}: back link vs title`).toBeLessThanOrEqual(m.ct.left + 0.5);
        if (m.trail !== null)
          expect(m.ct.right, `${at}: title vs actions`).toBeLessThanOrEqual(m.trail + 0.5);
        // The width comes from the Node side: mobile emulation grows innerWidth with an overflow.
        expect(
          Math.abs((m.ct.left + m.ct.right) / 2 - width / 2),
          `${at}: centred`,
        ).toBeLessThanOrEqual(1);
        expect(m.ellipsis, `${at}: the title is cut`).toBe(false);
        expect(m.label, `${at}: the back label`).not.toBe('partial');
        expect(m.docWidth, `${at}: page width`).toBeLessThanOrEqual(width);
      }
    });
  }

  // A long dynamic label (motion.ts writes the previous page's title into the span) collapses to
  // the chevron and stays the link's name. Not `not.toBeVisible()`: Playwright counts an element
  // clipped by overflow as visible, so the geometry is what shows it is gone.
  test('a label too long for its side collapses to the chevron and keeps the name', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await gotoHydrated(page, 'handbook/tests');
    const back = page.locator('header.top a.back');
    await back.locator('span').evaluate((s) => (s.textContent = 'Fuses, LEDs & jumpers'));
    await expect(back).toHaveAccessibleName('Fuses, LEDs & jumpers');
    const b = (await back.boundingBox())!;
    expect(b.height).toBe(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
    const m = await measure(page);
    expect(m.label).toBe('hidden');
    expect(m.back!.right).toBeLessThanOrEqual(m.ct.left + 0.5);
  });

  // The other way round: a label that fits beside the title is shown whole, not traded for the
  // chevron at a fixed width. A long Handbook section's short title leaves room for "Handbook";
  // "Results" is the label a card opened from Diagnose gets.
  test('a label that fits its side is shown whole', async ({ page }) => {
    for (const [route, width, text] of [
      ['handbook/menus', 360, 'Handbook'],
      ['switch/32', 320, 'Results'],
      ['switch/32', 412, 'Switches'],
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await gotoHydrated(page, route);
      const back = page.locator('header.top a.back');
      await back.locator('span').evaluate((s, t) => (s.textContent = t), text);
      const m = await measure(page);
      expect(m.label, `${route} at ${width}px`).toBe('whole');
      expect(m.back!.right, `${route} at ${width}px`).toBeLessThanOrEqual(m.ct.left + 0.5);
    }
  });

  // `overflow: clip`, not `hidden`: .back is not a scroll container, so find-in-page or a script
  // scrolling the label into view cannot bring a cut label up in place of the chevron.
  test('a collapsed label cannot be scrolled into the link', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await gotoHydrated(page, 'handbook/tests');
    const back = page.locator('header.top a.back');
    await back.locator('span').evaluate((s) => (s.textContent = 'Fuses, LEDs & jumpers'));
    expect((await measure(page)).label).toBe('hidden');
    const scrolled = await back.evaluate((a) => {
      a.querySelector('span')!.scrollIntoView({ block: 'center', inline: 'center' });
      a.scrollTop = 44;
      return a.scrollTop;
    });
    expect(scrolled).toBe(0);
    expect((await measure(page)).label).toBe('hidden');
  });

  // The side minimum, the chevron's line and the link's height are one rule, the touch target:
  // a larger --touch grows them all and the wrapped label still sits wholly below the link.
  test('the bar keeps a --touch target on each side', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await gotoHydrated(page, 'handbook/tests');
    const sizes = await page.evaluate(async () => {
      document.documentElement.style.setProperty('--touch', '48px');
      // A title at the 220 px cap would leave each side 42 px at 320.
      document.querySelector('header.top .ct .full')!.textContent =
        'A title far too long for the bar at this width';
      document.querySelector('header.top a.back span')!.textContent = 'Fuses, LEDs & jumpers';
      await document.fonts.ready;
      const box = (q: string) => document.querySelector(q)!.getBoundingClientRect();
      return {
        lead: box('header.top .lead').width,
        trail: box('header.top .trail').width,
        link: box('header.top a.back').height,
        chevron: box('header.top a.back svg').height,
      };
    });
    expect(sizes.lead).toBeGreaterThanOrEqual(47.5);
    expect(sizes.trail).toBeGreaterThanOrEqual(47.5);
    expect(sizes.link).toBe(48);
    expect(sizes.chevron).toBe(48);
    expect((await measure(page)).label).toBe('hidden');
  });
});

// The collapsed link keeps its whole side as the tap area, but its focus ring and hover pill go
// round the chevron alone (data-bare, set by Base's script), not round an empty box whose ring
// ran over the title. The chevron does not move, and a label that fits again brings the usual
// look back. Both projects: the phone for the keyboard ring, the desktop for hover.
test.describe('a bare back link', () => {
  test('draws its focus ring and hover pill round the chevron', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await gotoHydrated(page, 'handbook/tests');
    const back = page.locator('header.top a.back');
    const chevron = () => back.locator('svg path').evaluate((p) => p.getBoundingClientRect().left);
    await back.locator('span').evaluate((s) => (s.textContent = 'Tables'));
    await expect(back).not.toHaveAttribute('data-bare');
    const at = await chevron();

    await back.locator('span').evaluate((s) => (s.textContent = 'Fuses, LEDs & jumpers'));
    await expect(back).toHaveAttribute('data-bare', '');
    expect(await chevron()).toBeCloseTo(at, 1);
    await back.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const ring = await back.evaluate((a) => {
      const svg = a.querySelector('svg')!;
      const r = svg.getBoundingClientRect();
      return {
        visible: a.matches(':focus-visible'),
        link: getComputedStyle(a).outlineStyle,
        svg: getComputedStyle(svg).outlineStyle,
        width: r.width,
        height: r.height,
        right: r.right,
        title: document.querySelector('header.top .ct')!.getBoundingClientRect().left,
      };
    });
    expect(ring.visible).toBe(true);
    expect(ring.link).toBe('none');
    expect(ring.svg).toBe('solid');
    expect(ring.width).toBe(36);
    expect(ring.height).toBe(44);
    expect(ring.right).toBeLessThan(ring.title);

    if (await page.evaluate(() => matchMedia('(hover: hover)').matches)) {
      await back.hover();
      const bg = await back.evaluate((a) => [
        getComputedStyle(a).backgroundColor,
        getComputedStyle(a.querySelector('svg')!).backgroundColor,
      ]);
      expect(bg[0]).toBe('rgba(0, 0, 0, 0)');
      expect(bg[1]).not.toBe('rgba(0, 0, 0, 0)');
    }

    await back.locator('span').evaluate((s) => (s.textContent = 'Tables'));
    await expect(back).not.toHaveAttribute('data-bare');
    expect(await chevron()).toBeCloseTo(at, 1);
    await expect(back).toHaveCSS('outline-style', 'solid');
  });
});

test.describe('the desktop bar', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop width');

  test('a Handbook section keeps its full title and back label, left-aligned', async ({ page }) => {
    await gotoHydrated(page, 'handbook/menus');
    const ct = page.locator('header.top .ct');
    await expect(ct).toHaveCSS('text-align', 'left');
    await expect(ct.locator('.full')).toBeVisible();
    await expect(ct.locator('.full')).toHaveText('Menu system & bookkeeping');
    await expect(ct.locator('.short')).toBeHidden();
    expect((await measure(page)).label).toBe('whole');
  });
});
