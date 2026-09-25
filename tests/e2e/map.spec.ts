import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

/** Playfield map, Phase 1 of the app redesign: the fit rule, zoom, keys, controls, markers. */

const IMG = { w: 1246, h: 2702 };
const SIZES = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
  { width: 1440, height: 900 },
];

interface Geometry {
  scroller: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  canvas: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  scrollHeight: number;
  clientHeight: number;
  innerHeight: number;
  pageScrollHeight: number;
}
const geometry = (page: Page) =>
  page.evaluate((): Geometry => {
    const s = document.querySelector('.scroller')!;
    const c = document.querySelector('.canvas')!;
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      };
    };
    return {
      scroller: box(s),
      canvas: box(c),
      scrollHeight: s.scrollHeight,
      clientHeight: s.clientHeight,
      innerHeight: innerHeight,
      pageScrollHeight: document.documentElement.scrollHeight,
    };
  });
const canvasWidth = (page: Page) =>
  page.locator('.canvas').evaluate((el) => el.getBoundingClientRect().width);
/** True once the fit rule has sized the canvas (an inline px width). */
const fitted = (page: Page) =>
  page
    .locator('.canvas')
    .first()
    .evaluate((el) => (el as HTMLElement).style.width.endsWith('px'));
/** Within the plan's ±1 px. */
const near = (a: number, b: number) => Math.abs(a - b) <= 1;

for (const size of SIZES) {
  test(`fits the whole playfield at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await gotoHydrated(page, '/map?layer=sw');
    await expect.poll(() => fitted(page)).toBe(true);
    const g = await geometry(page);
    // Inside the scroller, touching its top.
    expect(g.canvas.left).toBeGreaterThanOrEqual(g.scroller.left - 0.5);
    expect(g.canvas.right).toBeLessThanOrEqual(g.scroller.right + 0.5);
    expect(g.canvas.bottom).toBeLessThanOrEqual(g.scroller.bottom + 0.5);
    expect(Math.abs(g.canvas.top - g.scroller.top)).toBeLessThanOrEqual(0.5);
    // Fills the width or the height.
    const fillsW = Math.abs(g.canvas.width - g.scroller.width) <= 1;
    const fillsH = Math.abs(g.canvas.height - g.scroller.height) <= 1;
    expect(fillsW || fillsH, 'canvas fills the stage width or height').toBe(true);
    // Aspect ratio of the drawing.
    expect(
      Math.abs(g.canvas.width / g.canvas.height - IMG.w / IMG.h) / (IMG.w / IMG.h),
    ).toBeLessThan(0.005);
    // The stage ends inside the viewport and doesn't scroll at 1×.
    expect(g.scroller.bottom).toBeLessThanOrEqual(g.innerHeight + 0.5);
    expect(g.scrollHeight).toBeLessThanOrEqual(g.clientHeight + 1);
    if (size.width >= 1000) expect(g.pageScrollHeight).toBeLessThanOrEqual(g.innerHeight + 1);
  });
}

test('the map is full bleed and the home page keeps its footer', async ({ page }) => {
  await gotoHydrated(page, '/map');
  await expect(page.locator('footer.foot')).toHaveCount(0);
  await expect(page.locator('main.fullbleed')).toHaveCount(1);
  await gotoHydrated(page, '/');
  await expect(page.locator('footer.foot p').first()).toContainText('© Williams');
});

test('zoom in, fit and the 0 key', async ({ page }) => {
  await gotoHydrated(page, '/map?layer=sw');
  const zoomGroup = page.getByRole('group', { name: 'Zoom' });
  const fit = zoomGroup.getByRole('button', { name: 'Fit whole playfield' });
  await expect(fit).toHaveAttribute('aria-disabled', 'true');
  await expect.poll(() => fitted(page)).toBe(true);
  const w1 = await canvasWidth(page);
  await zoomGroup.getByRole('button', { name: 'Zoom in' }).click();
  await expect(fit).not.toHaveAttribute('aria-disabled', 'true');
  await expect.poll(async () => near(await canvasWidth(page), w1 * 1.6)).toBe(true);
  await fit.click();
  await expect.poll(async () => near(await canvasWidth(page), w1)).toBe(true);
  await expect(fit).toHaveAttribute('aria-disabled', 'true');
  await zoomGroup.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(async () => near(await canvasWidth(page), w1 * 1.6)).toBe(true);
  await page.locator('.scroller').focus();
  await page.keyboard.press('0');
  await expect.poll(async () => near(await canvasWidth(page), w1)).toBe(true);
});

test('keys zoom the focused stage and Esc deselects', async ({ page }) => {
  await gotoHydrated(page, '/map?layer=sw&id=32');
  await expect(page).toHaveURL(/id=32/);
  await expect.poll(() => fitted(page)).toBe(true);
  const w1 = await canvasWidth(page);
  await page.locator('.scroller').focus();
  await page.keyboard.press('+');
  await expect.poll(async () => near(await canvasWidth(page), w1 * 1.6)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/id=/);
  await expect(page.locator('.marker.sel')).toHaveCount(0);
});

test('the handbook embed ignores keys typed elsewhere', async ({ page }) => {
  await gotoHydrated(page, '/handbook/rules');
  const embed = page.locator('#pg-9 .shot-map');
  await embed.scrollIntoViewIfNeeded();
  await expect(embed.locator('.marker.k-shot')).toHaveCount(17);
  const canvas = embed.locator('.canvas');
  await expect
    .poll(() => canvas.evaluate((el) => (el as HTMLElement).style.width.endsWith('px')))
    .toBe(true);
  const before = await canvas.evaluate((el) => el.getBoundingClientRect().width);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('+');
  await page.waitForTimeout(400);
  expect(await canvas.evaluate((el) => el.getBoundingClientRect().width)).toBe(before);
  // The embed is never cropped: the drawing lies inside its scroller.
  const g = await embed.evaluate((root) => {
    const s = root.querySelector('.scroller')!.getBoundingClientRect();
    const c = root.querySelector('.canvas')!.getBoundingClientRect();
    return { s, c, inner: innerHeight };
  });
  expect(g.c.bottom).toBeLessThanOrEqual(g.s.bottom + 0.5);
  expect(g.s.height).toBeLessThanOrEqual(g.inner + 0.5);
});

test('layer and zoom controls are at least 44 px', async ({ page }) => {
  await gotoHydrated(page, '/map?layer=sw');
  for (const name of ['Layers', 'Zoom']) {
    const buttons = page.getByRole('group', { name }).getByRole('button');
    const n = await buttons.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box, `${name} button ${i} visible`).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  // Exactly one Layers control is rendered.
  await expect(page.getByRole('group', { name: 'Layers' })).toHaveCount(1);
});

test('markers select by name, by the nearest-centre rule, and never on a drag', async ({
  page,
}) => {
  await gotoHydrated(page, '/map?layer=sw,shot');
  const jet = page.getByRole('button', { name: /^32 Upper Right Jet/ }).first();
  await jet.click();
  await expect(jet).toHaveAttribute('aria-pressed', 'true');
  const book = page.getByRole('button', { name: /^K Bookcase/ }).first();
  await book.click();
  await expect(book).toHaveAttribute('aria-pressed', 'true');
  await expect(jet).toHaveAttribute('aria-pressed', 'false');

  // A point 20 px from switch 32's centre with no other marker nearer. Try the four directions.
  const centres = await page.locator('.canvas .marker').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        name: el.getAttribute('aria-label') ?? '',
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      };
    }),
  );
  const c32 = centres.find((c) => c.name.startsWith('32 '))!;
  expect(c32).toBeTruthy();
  const dirs = [
    [20, 0],
    [-20, 0],
    [0, 20],
    [0, -20],
  ];
  let point: { x: number; y: number } | undefined;
  for (const [dx, dy] of dirs) {
    const p = { x: c32.x + dx!, y: c32.y + dy! };
    const nearest = centres.reduce((a, b) =>
      Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y) ? b : a,
    );
    if (nearest === c32) {
      point = p;
      break;
    }
  }
  expect(point, 'a point 20 px from switch 32 where it is the nearest marker').toBeTruthy();
  await page.mouse.click(point!.x, point!.y);
  await expect(jet).toHaveAttribute('aria-pressed', 'true');

  // A 30 px drag from the same point selects nothing new.
  await book.click();
  await expect(book).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(point!.x, point!.y);
  await page.mouse.down();
  await page.mouse.move(point!.x + 15, point!.y + 15, { steps: 3 });
  await page.mouse.move(point!.x + 30, point!.y + 30, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  await expect(book).toHaveAttribute('aria-pressed', 'true');
  await expect(jet).toHaveAttribute('aria-pressed', 'false');
});

test('links use the amber ink of each theme', async ({ page }) => {
  await gotoHydrated(page, '/map?layer=sw');
  const link = page.locator('aside a.src');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => delete document.documentElement.dataset.theme);
  await expect(link).toHaveCSS('color', 'rgb(168, 68, 10)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(link).toHaveCSS('color', 'rgb(255, 138, 61)');
});

test('reduced motion: fit and the zoom steps land without a transform animation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await gotoHydrated(page, '/map?layer=sw');
  await expect.poll(() => fitted(page)).toBe(true);
  const w1 = await canvasWidth(page);
  const zoomGroup = page.getByRole('group', { name: 'Zoom' });
  const running = () =>
    page
      .locator('.canvas')
      .evaluate((el) => el.getAnimations().filter((a) => a.playState === 'running').length);
  await zoomGroup.getByRole('button', { name: 'Zoom in' }).click();
  expect(await running()).toBe(0);
  expect(near(await canvasWidth(page), w1 * 1.6)).toBe(true);
  await zoomGroup.getByRole('button', { name: 'Fit whole playfield' }).click();
  expect(await running()).toBe(0);
  expect(near(await canvasWidth(page), w1)).toBe(true);
});
