import { expect, test, type Page } from '@playwright/test';
import { activate, gotoHydrated, twoFrames } from './helpers';

/** Playfield map, Phases 1–2 of the app redesign: fit, zoom, keys, markers, the sheets, the panel. */

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

test('a zoomed deep link lands without a runtime error (SV-03)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await gotoHydrated(page, '/map?layer=sw');
  await expect.poll(() => fitted(page)).toBe(true);
  const w1 = await canvasWidth(page);
  await gotoHydrated(page, '/map?layer=sw&z=2');
  await expect(page.locator('.scroller')).toHaveClass(/zoomed/);
  // It lands: the canvas is twice the fit, as the zoom test measures it.
  await expect.poll(async () => near(await canvasWidth(page), w1 * 2)).toBe(true);
  const fit = page
    .getByRole('group', { name: 'Zoom' })
    .getByRole('button', { name: 'Fit whole playfield' });
  await expect(fit).not.toHaveAttribute('aria-disabled', 'true');
  expect(errors).toEqual([]);
});

test('z just above 1 reads as the fit (two decimals, as the URL is written)', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await gotoHydrated(page, '/map?layer=sw&z=1.0001');
  await expect.poll(() => fitted(page)).toBe(true);
  await expect(page.locator('.scroller')).not.toHaveClass(/zoomed/);
  const fit = page
    .getByRole('group', { name: 'Zoom' })
    .getByRole('button', { name: 'Fit whole playfield' });
  await expect(fit).toHaveAttribute('aria-disabled', 'true');
  expect(errors).toEqual([]);
});

test('the calibration tool is not loaded without ?calib=1 (SV-08)', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await gotoHydrated(page, '/map?layer=sw');
  await expect.poll(() => fitted(page)).toBe(true);
  expect(urls.filter((u) => /MapCalibration/.test(u))).toEqual([]);
  const island = page.locator('astro-island[component-url*="PlayfieldMap"]').first();
  const chunk = await island.getAttribute('component-url');
  expect(chunk).toBeTruthy();
  const text = await (await page.request.get(new URL(chunk!, page.url()).href)).text();
  expect(text).not.toContain('Copy JSON');
  expect(text).not.toContain('taf.positions.draft');
});

test('?calib=1 loads the calibration chunk and shows the card', async ({ page }) => {
  const loaded = page.waitForRequest(/_astro\/MapCalibration\./);
  await gotoHydrated(page, '/map?calib=1&layer=sw');
  await loaded;
  await expect(page.locator('.card.calib')).toBeVisible();
  await expect(page.getByRole('button', { name: /Copy JSON/ })).toBeVisible();
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
  // A zoom sets the size at once and eases a transform: none running means none started.
  await expect.poll(() => canvas.evaluate((el) => el.getAnimations().length)).toBe(0);
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
  const jet = page.getByRole('button', { name: /^Switch 32, Upper Right Jet/ }).first();
  await jet.click();
  await expect(jet).toHaveAttribute('aria-pressed', 'true');
  const book = page.getByRole('button', { name: /^Shot K, Bookcase/ }).first();
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
  const c32 = centres.find((c) => c.name.startsWith('Switch 32,'))!;
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
  await twoFrames(page);
  await expect(book).toHaveAttribute('aria-pressed', 'true');
  await expect(jet).toHaveAttribute('aria-pressed', 'false');
});

test('links use the amber ink of each theme', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoHydrated(page, '/map?layer=sw');
  const link = page.locator('aside a.src');
  // Each theme's --amber-ink, read from the page, so retuning the token does not break this test.
  const amberInk = () =>
    page.evaluate(() => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--amber-ink)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => delete document.documentElement.dataset.theme);
  const light = await amberInk();
  await expect(link).toHaveCSS('color', light);
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await amberInk();
  expect(dark).not.toBe(light);
  await expect(link).toHaveCSS('color', dark);
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

/* ---------- Phase 2: the selection sheet, the parts sheet and the wide panel ---------- */

const SHEET = 'section.sheet[aria-label^="Selected component"]';
const box = async (page: Page, sel: string) => {
  const b = await page.locator(sel).boundingBox();
  expect(b, `${sel} has a box`).not.toBeNull();
  return b!;
};
const centreY = async (page: Page, sel: string) => {
  const b = await box(page, sel);
  return b.y + b.height / 2;
};

test.describe('phone selection sheet', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('peek re-fits the drawing above it; the controls sit 12 px above the sheet', async ({
    page,
  }) => {
    await gotoHydrated(page, '/map?layer=sw&id=32');
    const sheet = page.locator(SHEET);
    await expect(sheet).toHaveAttribute('aria-label', 'Selected component, Switch 32');
    await expect(sheet).toHaveAttribute('data-id', '32');
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Upper Right Jet');
    await expect(sheet.getByText('Switch · matrix column 3, row 2')).toBeVisible();
    const grab = sheet.getByRole('button', { name: 'Expand details' });
    await expect(grab).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => fitted(page)).toBe(true);
    // The sheet sits inside the viewport at 96 px, the drawing ends at its top edge.
    await expect
      .poll(async () => {
        const s = await box(page, SHEET);
        const g = await geometry(page);
        return (
          near(s.height, 96) &&
          s.y + s.height <= g.innerHeight + 0.5 &&
          g.canvas.bottom <= s.y + 0.5 &&
          near(g.canvas.height, g.scroller.height - 96)
        );
      })
      .toBe(true);
    // The sheet is still rising for its first 300 ms, so the column is measured against the
    // sheet's live top, not a captured one.
    await expect
      .poll(async () => {
        const s = await box(page, SHEET);
        const c = await box(page, '.map-controls .column');
        return near(c.y + c.height, s.y - 12);
      })
      .toBe(true);
    expect(await centreY(page, '.marker.sel')).toBeLessThan((await box(page, SHEET)).y);
    // No page scroll and no stage scroll at 1×.
    const g = await geometry(page);
    expect(g.scrollHeight).toBeLessThanOrEqual(g.clientHeight + 1);
    expect(g.pageScrollHeight).toBeLessThanOrEqual(g.innerHeight + 1);
  });

  test('the grabber expands to 416, hides the controls and keeps the part in view; Esc closes', async ({
    page,
  }) => {
    await gotoHydrated(page, '/map?layer=sw&id=32');
    const sheet = page.locator(SHEET);
    await expect.poll(() => fitted(page)).toBe(true);
    await sheet.getByRole('button', { name: 'Expand details' }).click();
    const grab = sheet.getByRole('button', { name: 'Collapse details' });
    await expect(grab).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(async () => near((await box(page, SHEET)).height, 416)).toBe(true);
    await expect(sheet.getByRole('heading', { name: 'Wiring' })).toBeVisible();
    await expect(
      sheet.getByRole('navigation', { name: 'More about switch 32', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.map-controls .column')).toBeHidden();
    // The selected marker stays in the band above the sheet.
    await expect
      .poll(async () => {
        const y = await centreY(page, '.marker.sel');
        const s = await box(page, SHEET);
        const g = await geometry(page);
        return y > g.scroller.top && y < s.y;
      })
      .toBe(true);
    // Collapse again: the controls return.
    await grab.click();
    await expect(sheet.getByRole('button', { name: 'Expand details' })).toBeVisible();
    await expect(page.locator('.map-controls .column')).toBeVisible();
    // Esc deselects, the sheet leaves, the drawing re-fits to the whole stage.
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page).not.toHaveURL(/id=/);
    await expect
      .poll(async () => {
        const g = await geometry(page);
        return near(g.canvas.height, g.scroller.height) || near(g.canvas.width, g.scroller.width);
      })
      .toBe(true);
  });

  test('Deselect closes the sheet', async ({ page }) => {
    await gotoHydrated(page, '/map?layer=sw&id=32');
    await page.locator(SHEET).getByRole('button', { name: 'Deselect' }).click();
    await expect(page.locator(SHEET)).toHaveCount(0);
    await expect(page).not.toHaveURL(/id=/);
  });

  test('the parts sheet filters, picks and hands focus back', async ({ page, browserName }) => {
    await gotoHydrated(page, '/map?layer=sw');
    const opener = page.getByRole('button', { name: 'All components on the map' });
    await activate(opener, browserName);
    const dialog = page.getByRole('dialog', { name: 'All components on the map' });
    await expect(dialog).toBeVisible();
    const find = dialog.getByRole('searchbox', { name: 'Search components' });
    await expect(find).toBeFocused();
    await find.fill('jet');
    const rows = dialog.locator('.rows .row');
    await expect(rows.first()).toBeVisible();
    for (const text of await rows.allInnerTexts()) expect(text.toLowerCase()).toContain('jet');
    await dialog.getByRole('button', { name: /^32\s+Upper Right Jet/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    await expect(page.locator(SHEET)).toHaveAttribute(
      'aria-label',
      'Selected component, Switch 32',
    );
    await expect(
      page.locator(SHEET).getByRole('button', { name: 'Expand details' }),
    ).toHaveAttribute('aria-expanded', 'false');
    await expect(page).toHaveURL(/id=switch:32/);
  });

  test('reduced motion: the sheet and the canvas move without animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoHydrated(page, '/map?layer=sw&id=32');
    await expect.poll(() => fitted(page)).toBe(true);
    await page.locator(SHEET).getByRole('button', { name: 'Expand details' }).click();
    await expect.poll(async () => near((await box(page, SHEET)).height, 416)).toBe(true);
    // Fades are allowed under reduced motion (spec §10); nothing else may move.
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => (a as CSSTransition).transitionProperty ?? (a as CSSAnimation).animationName)
        .filter((n) => n !== 'opacity' && n !== 'visibility' && !/fade/.test(n)),
    );
    expect(moving).toEqual([]);
  });
});

for (const size of SIZES) {
  test(`a selected part never makes the page scroll at ${size.width}×${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await gotoHydrated(page, '/map?layer=sw&id=32');
    await expect.poll(() => fitted(page)).toBe(true);
    await expect
      .poll(async () => {
        const g = await geometry(page);
        return (
          g.scrollHeight <= g.clientHeight + 1 &&
          g.scroller.bottom <= g.innerHeight + 0.5 &&
          (size.width < 1000 || g.pageScrollHeight <= g.innerHeight + 1)
        );
      })
      .toBe(true);
  });
}

test.describe('wide panel', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('holds the selected part and the list; the selected row is current', async ({ page }) => {
    await gotoHydrated(page, '/map?layer=sw&id=32');
    const panel = page.getByRole('complementary', {
      name: 'Selected component and components on the map',
    });
    await expect(panel).toBeVisible();
    expect(near((await panel.boundingBox())!.width, 420)).toBe(true);
    await expect(panel.locator('article.comp[data-id="32"]')).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Switch 32' })).toBeVisible();
    await expect(panel.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(panel.locator('[aria-current="true"]')).toContainText('Upper Right Jet');
    await expect(page.locator(SHEET)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'All components on the map' })).toHaveCount(0);
    // Search components narrows the list.
    await panel.getByRole('searchbox', { name: 'Search components' }).fill('zzz');
    await expect(panel.locator('.rows .row')).toHaveCount(0);
    await panel.getByRole('searchbox', { name: 'Search components' }).fill('32');
    await expect(panel.locator('.rows .row').first()).toContainText('Upper Right Jet');
  });

  test('a list row says "not used" once, in its name', async ({ page }) => {
    await gotoHydrated(page, '/map?layer=sw');
    const panel = page.getByRole('complementary', {
      name: 'Selected component and components on the map',
    });
    const row = panel.getByRole('button', { name: /^11\s+Not Used/ });
    await expect(row.locator('.sub')).toHaveText('Matrix column 1, row 1');
    await expect(row).toContainText('not on map');
  });

  test('a Fault persists across a reload and names the marker', async ({ page }) => {
    await gotoHydrated(page, '/map?layer=sw&id=32');
    await page
      .getByRole('group', { name: 'Test status' })
      .getByRole('button', { name: 'Fault' })
      .click();
    await page.reload();
    await expect(
      page.getByRole('group', { name: 'Test status' }).getByRole('button', { name: 'Fault' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('button', { name: /^Switch 32, Upper Right Jet, Fault, selected$/ }),
    ).toHaveCount(1);
  });

  test('nothing selected shows the Playfield card and the provenance', async ({ page }) => {
    await gotoHydrated(page, '/map');
    const panel = page.getByRole('complementary', {
      name: 'Selected component and components on the map',
    });
    await expect(panel.getByRole('heading', { name: 'Playfield' })).toBeVisible();
    await expect(panel.locator('.prov')).toBeVisible();
  });
});

test('the handbook embed has no sheet: the shot card sits under the drawing', async ({ page }) => {
  await gotoHydrated(page, '/handbook/rules');
  const embed = page.locator('#pg-9 .shot-map');
  await embed.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      embed.locator('.canvas').evaluate((el) => (el as HTMLElement).style.width.endsWith('px')),
    )
    .toBe(true);
  const url = page.url();
  const k = embed.getByRole('button', { name: /^Shot K, Bookcase/ }).first();
  await k.click();
  await expect(k).toHaveAttribute('aria-pressed', 'true');
  expect(page.url()).toBe(url);
  await expect(page.locator(SHEET)).toHaveCount(0);
  await expect(page.locator('#pg-9 article.shot-card[data-id="K"]')).toBeVisible();
});
