import { expect, test } from '@playwright/test';
import { activate, gotoHydrated, hydrated } from './helpers';

/* Phase 8 of the app redesign: the Handbook tab's segmented links, the Handbook home, the reader
   toolbar, the manual viewer toolbar with its Go to page sheet and zoom capsule, and Parts. */

test.describe('the segmented links', () => {
  for (const [path, name] of [
    ['/handbook', 'Handbook'],
    ['/manual', 'Manuals'],
    ['/parts', 'Parts'],
  ] as const) {
    test(`${path} marks "${name}" as the current page`, async ({ page }) => {
      await gotoHydrated(page, path);
      const nav = page.getByRole('navigation', { name: 'Handbook, Manuals or Parts' });
      await expect(nav.getByRole('link')).toHaveText(['Handbook', 'Manuals', 'Parts']);
      await expect(nav.locator('a[aria-current="page"]')).toHaveText(name);
      await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
    });
  }
});

test.describe('the Handbook home', () => {
  test('lists the operator sections and the owner notes, and searches headings', async ({
    page,
  }) => {
    await gotoHydrated(page, '/handbook');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Handbook');
    await expect(page.getByRole('link', { name: /^Test menu/ })).toHaveAttribute(
      'href',
      /handbook\/tests$/,
    );
    await expect(page.getByRole('link', { name: /^Test menu/ })).toContainText(
      '1-15\u202f–\u202f1-19',
    );
    await expect(page.getByRole('link', { name: /A6.*Flippers/ })).toHaveAttribute(
      'href',
      /handbook\/appendix#p106-1$/,
    );
    await expect(page.getByText('Notes written for this machine, not manual text.')).toBeVisible();
    await expect(page.getByText(/Pages 1-16 to 1-18 are transcribed/)).toBeVisible();
    await expect(page.locator('[data-continue]')).toBeHidden();

    const field = page.getByLabel('Search the handbook', { exact: true });
    await expect(page.locator('nav.toc ul')).toHaveCount(0);
    await field.fill('flipper');
    await expect(page.locator('nav.toc li a').first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Search the manuals for “flipper”' }),
    ).toHaveAttribute('href', /manual\?q=flipper$/);
  });

  test('Continue reading points at the page last read', async ({ page }) => {
    await gotoHydrated(page, '/handbook/tests');
    await gotoHydrated(page, '/handbook');
    const cont = page.locator('[data-continue]');
    await expect(cont).toBeVisible();
    await expect(cont.locator('.ttl')).toHaveText('Test menu');
    await expect(cont.locator('.sub')).toHaveText('p. 1-15');
    await expect(cont.getByRole('link')).toHaveAttribute('href', /handbook\/tests#pg-25$/);
  });

  test('"Search the manuals" hands the query to the manual search', async ({ page }) => {
    await gotoHydrated(page, '/manual?q=flipper');
    await expect(page.getByLabel('Search the manuals', { exact: true })).toHaveValue('flipper');
    await expect(page.locator('.msearch a[href*="/manual/"]').first()).toBeVisible();
  });

  // DS-01: the global .search field rule used to also match this wrapper and collapse it to
  // 36px, so a tap on a hit landed on whatever TOC link sat underneath instead.
  test('tapping a page-text hit opens the tapped page, not a neighboring one', async ({ page }) => {
    await gotoHydrated(page, '/manual?q=flipper');
    const hit = page.locator('.msearch a[href*="/manual/"]').first();
    await expect(hit).toHaveAttribute('href', /\/manual\//);
    const href = (await hit.getAttribute('href'))!;
    await hit.click();
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  });
});

test.describe('the reader', () => {
  test('has the back link, View the manual page and the bottom toolbar; Contents opens a sheet', async ({
    page,
    browserName,
  }) => {
    await gotoHydrated(page, '/handbook/tests');
    await expect(page.locator('header.top a.back')).toHaveText('Handbook');
    await expect(page.getByRole('link', { name: 'View the manual page' })).toHaveAttribute(
      'href',
      /manual\/ops\/25$/,
    );
    // Each end's name holds the page it shows, so a voice command can say it (AY2-09).
    const bar = page.getByRole('navigation', { name: 'Reader' });
    await expect(
      bar.getByRole('link', { name: 'Previous: 1-14 Menu system and bookkeeping', exact: true }),
    ).toHaveText('1-14');
    await expect(bar.getByRole('link', { name: 'Next: 1-20 Utilities', exact: true })).toHaveText(
      '1-20',
    );
    await expect(page.locator('.pg-bar').first()).toContainText('p. 1-15');
    // The bar says the page once: the marker, then a "Manual" button named with the page.
    const pg = page.locator('.pg-bar').first();
    const toManual = pg.getByRole('link', { name: 'Manual p. 1-15', exact: true });
    await expect(toManual).toHaveText('Manual');
    await expect(toManual).toHaveAttribute('href', /manual\/ops\/25$/);
    await expect(pg.locator('.mono')).toHaveAttribute('aria-hidden', 'true');

    const contents = bar.getByRole('button', { name: 'Contents' });
    await activate(contents, browserName);
    const dialog = page.getByRole('dialog', { name: 'Contents' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Search the handbook')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Utilities' }).first()).toHaveAttribute(
      'href',
      /handbook\/utilities$/,
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(contents).toBeFocused();
  });

  test('Text size changes the prose size and is remembered', async ({ page }) => {
    await gotoHydrated(page, '/handbook/tests');
    const before = await page
      .locator('article.prose')
      .evaluate((el) => getComputedStyle(el).fontSize);
    await page.getByRole('button', { name: 'Text size' }).click();
    const dialog = page.getByRole('dialog', { name: 'Text size' });
    await dialog.getByRole('button', { name: 'Large' }).click();
    await expect(dialog.getByRole('button', { name: 'Large' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const after = await page
      .locator('article.prose')
      .evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(after)).toBeGreaterThan(parseFloat(before));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-text', 'lg');
    await page.getByRole('button', { name: 'Text size' }).click();
    await page
      .getByRole('dialog', { name: 'Text size' })
      .getByRole('button', { name: 'Default' })
      .click();
    await expect(page.locator('html')).not.toHaveAttribute('data-text', /./);
  });

  test('a figure holds its box before its file arrives; its caption carries its text (AY2-06)', async ({
    page,
  }) => {
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/assets/figures/**', async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto('/handbook/rules', { waitUntil: 'domcontentloaded' });
    await hydrated(page);
    const img = page.locator('figure.fig img').first();
    await img.scrollIntoViewIfNeeded();
    const g = await img.evaluate((el: HTMLImageElement) => {
      const r = el.getBoundingClientRect();
      return {
        w: r.width,
        h: r.height,
        loaded: el.naturalWidth > 0,
        ratio: Number(el.getAttribute('width')) / Number(el.getAttribute('height')),
        alt: el.getAttribute('alt'),
        cap: el.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ?? '',
      };
    });
    release();
    expect(g.loaded, 'the file is held back').toBe(false);
    expect(g.w).toBeGreaterThan(100);
    expect(g.w / g.h).toBeCloseTo(g.ratio, 1);
    expect(g.alt).toBe('');
    expect(g.cap.length).toBeGreaterThan(10);
    // Once it arrives, the box keeps its size.
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    const after = await img.boundingBox();
    expect(Math.abs(after!.height - g.h)).toBeLessThan(1.5);
  });
});

test.describe('the manual viewer', () => {
  test('the toolbar pages, "97 of 124" opens Go to page, and 30 + Go lands on page 30', async ({
    page,
  }) => {
    await gotoHydrated(page, '/manual/ops/97');
    await expect(page.locator('h1 .full')).toHaveText('Operations Manual p. 2-39');
    await expect(page.locator('header.top a.back')).toHaveText('Manuals');
    const tb = page.getByRole('toolbar', { name: 'Page' });
    await expect(tb.getByRole('link', { name: 'Previous page' })).toHaveAttribute(
      'href',
      /manual\/ops\/96$/,
    );
    await expect(tb.getByRole('link', { name: 'Next page' })).toHaveAttribute(
      'href',
      /manual\/ops\/98$/,
    );
    const seg = page.getByRole('navigation', { name: 'Document' });
    await expect(seg.locator('a[aria-current="page"]')).toHaveText('Operations');
    await expect(seg.getByRole('link', { name: 'Schematics' })).toHaveAttribute(
      'href',
      /manual\/wpc\/1$/,
    );
    await expect(seg.getByRole('link', { name: "Operator's" })).toHaveAttribute(
      'href',
      /manual\/hb\/1$/,
    );
    await expect(page.getByRole('heading', { level: 2, name: 'Contents' })).toBeVisible();
    await expect(page.locator('.lst a[aria-current="true"]')).toHaveCount(1);
    await expect(
      page.getByText('Manual pages are saved on the device as you open them.'),
    ).toBeVisible();

    const open = tb.getByRole('button', { name: 'Go to page (97 of 124)' });
    await expect(open).toHaveText('97 of 124');
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Go to page' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Done' })).toBeVisible();
    const field = dialog.getByLabel('Page');
    await expect(field).toBeFocused();
    await field.fill('30');
    await dialog.getByRole('button', { name: 'Go' }).click();
    await expect(page).toHaveURL(/manual\/ops\/30$/);
  });

  test('Esc closes Go to page and returns focus; a printed number also works', async ({
    page,
    browserName,
  }) => {
    await gotoHydrated(page, '/manual/ops/97');
    const open = page.getByRole('button', { name: /^Go to page/ });
    await activate(open, browserName);
    await expect(page.getByRole('dialog', { name: 'Go to page' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(open).toBeFocused();
    await activate(open, browserName);
    const dialog = page.getByRole('dialog', { name: 'Go to page' });
    await dialog.getByLabel('Page').fill('2-39');
    await dialog.getByRole('button', { name: 'Go' }).click();
    await expect(page).toHaveURL(/manual\/ops\/97$/);
  });

  test('Go to page refuses a label the manual does not print, and takes the ones it does (CR2-04)', async ({
    page,
  }) => {
    await gotoHydrated(page, '/manual/ops/97');
    await page.getByRole('button', { name: /^Go to page/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Go to page' });
    const field = dialog.getByLabel('Page');
    await expect(field).toHaveAttribute('inputmode', 'text');
    await field.fill('1-49');
    await dialog.getByRole('button', { name: 'Go' }).click();
    await expect(dialog.locator('#goto-hint')).toContainText('No such page');
    await expect(page).toHaveURL(/manual\/ops\/97$/);
    await field.fill('p. E');
    await dialog.getByRole('button', { name: 'Go' }).click();
    await expect(page).toHaveURL(/manual\/ops\/9$/);
  });

  test('zoom capsule and Rotate page act on the scan; the keys still work', async ({
    page,
    isMobile,
  }) => {
    // The default fit (spec §9.12): fit page from 1000, fit width below. A kept choice is cleared.
    await page.addInitScript(() => {
      try {
        localStorage.removeItem('tafh:manual-fit');
      } catch {
        // No storage: the default applies anyway.
      }
    });
    const defaultFit = isMobile ? 'Fit width' : 'Fit page';
    await gotoHydrated(page, '/manual/ops/25');
    const scan = page.locator('.sheet.scan');
    await expect(page.locator('.stage img').first()).toBeVisible();
    const fitW = (await scan.boundingBox())!.width;
    const zoom = page.getByRole('group', { name: 'Zoom' });
    for (const name of ['Zoom in', 'Zoom out', 'Fit width', 'Fit page']) {
      const b = (await zoom.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    await zoom.getByRole('button', { name: 'Zoom in' }).click();
    await expect.poll(async () => (await scan.boundingBox())!.width).toBeGreaterThan(fitW + 1);
    await zoom.getByRole('button', { name: defaultFit, exact: true }).click();
    await expect
      .poll(async () => Math.round((await scan.boundingBox())!.width))
      .toBe(Math.round(fitW));
    await page.keyboard.press('+');
    await expect.poll(async () => (await scan.boundingBox())!.width).toBeGreaterThan(fitW + 1);
    await page.keyboard.press('0');
    await expect
      .poll(async () => Math.round((await scan.boundingBox())!.width))
      .toBe(Math.round(fitW));

    const rotation = () =>
      scan.evaluate((el) => (el as HTMLElement).style.transform.match(/rotate\((\d+)deg\)/)![1]);
    await expect.poll(rotation).toBe('0');
    await page.getByRole('button', { name: 'Rotate page' }).click();
    await expect.poll(rotation).toBe('90');
    await page.keyboard.press('r');
    await expect.poll(rotation).toBe('180');
  });

  test('"Search the manuals" is on /manual and on the viewer page', async ({ page }) => {
    await gotoHydrated(page, '/manual');
    await expect(page.getByLabel('Search the manuals', { exact: true })).toBeVisible();
    await gotoHydrated(page, '/manual/ops/25');
    await page.getByLabel('Search the manuals', { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Search the manuals', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Read the transcription/ })).toHaveAttribute(
      'href',
      /handbook\/tests#pg-25$/,
    );
  });

  test("a component's manual link rings its callout, zoomed to and in view (UX2-07)", async ({
    page,
  }) => {
    await gotoHydrated(page, '/switch/32');
    await expect(page.locator('a[href$="manual/ops/97?mark=32"]').first()).toBeAttached();
    await gotoHydrated(page, '/manual/ops/97?mark=32');
    const ring = page.locator('.mark');
    await expect(ring).toHaveCount(1);
    await expect(ring).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.stage')).toHaveAttribute('aria-label', /callout 32 ringed/);
    // Zoomed far enough to read the print, and on the printed 32 (p. 2-39, at 0.6475, 0.345).
    const scan = (await page.locator('.sheet.scan').boundingBox())!;
    expect(scan.width).toBeGreaterThanOrEqual(1530 * 0.6 - 1);
    const r = (await ring.boundingBox())!;
    expect(Math.abs((r.x + r.width / 2 - scan.x) / scan.width - 0.6475)).toBeLessThan(0.005);
    expect(Math.abs((r.y + r.height / 2 - scan.y) / scan.height - 0.345)).toBeLessThan(0.005);
    // Clear of the top bar and the phone tab bar, and outside the dark theme's scan filter.
    const clear = await ring.evaluate((e) => {
      const px = (n: string) =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue(n)) || 0;
      const b = e.getBoundingClientRect();
      return b.top >= px('--topbar-h') && b.bottom <= innerHeight - px('--tabbar-h');
    });
    expect(clear).toBe(true);
    expect(await page.locator('.sheet.marks').evaluate((e) => getComputedStyle(e).filter)).toBe(
      'none',
    );
    // Switch 44 prints 44a and 44b twice each: its link names each once, and all four are ringed.
    await gotoHydrated(page, '/switch/44');
    await expect(page.locator('a[href$="manual/ops/97?mark=44b,44a"]').first()).toBeAttached();
    await gotoHydrated(page, '/manual/ops/97?mark=44b,44a');
    await expect(page.locator('.mark')).toHaveCount(4);
    await expect(page.locator('.stage')).toHaveAttribute('aria-label', /callouts 44b, 44a ringed/);
    // No mark, or a mark the page does not print: nothing ringed, the fit untouched.
    await gotoHydrated(page, '/manual/ops/97');
    await expect(page.locator('.mark')).toHaveCount(0);
    await gotoHydrated(page, '/manual/ops/25?mark=32');
    await expect(page.locator('.mark')).toHaveCount(0);
    await expect(page.locator('.stage')).not.toHaveAttribute('aria-label', /.+/);
  });
});

test('Parts: Search parts, Clear search, the row count and four columns', async ({ page }) => {
  await gotoHydrated(page, '/parts');
  await expect(page.locator('table.t thead th')).toHaveText([
    'Item',
    'Part no.',
    'Description',
    'Qty',
  ]);
  await expect(page.getByRole('button', { name: 'Clear search' })).toHaveCount(0);
  await expect(page.getByText(/Descriptions are machine-read from the original/)).toBeVisible();
  await page.getByLabel('Search parts').fill('flipper');
  await expect(page.locator('.count')).toHaveText(/^\d+ rows/);
  await expect(page.locator('tbody tr').first()).toContainText(/flipper/i);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByLabel('Search parts')).toHaveValue('');
  await expect(page.getByLabel('Search parts')).toBeFocused();
  await expect(page.locator('.count')).toContainText('Top-level assemblies');
});

// CO-12, DA-10: a part search hit links to /parts#<no>, a row that sits below the default
// top-level cutoff and previously had no id for the hash to find.
test('/parts#<no> reveals, scrolls to and highlights that row, on load and on hashchange', async ({
  page,
}) => {
  await gotoHydrated(page, '/parts#01-10020');
  await expect(page.getByLabel('Search parts')).toHaveValue('01-10020');
  const first = page.locator('tr[data-part="01-10020"]');
  await expect(first).toBeVisible();
  await expect(first).toHaveClass(/hl/);
  await expect(first).toContainText('cover-domestic cashbox');

  // A same-document hash change (no reload, no new gotoHydrated) should reveal the new target too.
  await page.evaluate(() => {
    location.hash = '#01-9989';
  });
  await expect(page.getByLabel('Search parts')).toHaveValue('01-9989');
  const second = page.locator('tr[data-part="01-9989"]');
  await expect(second).toBeVisible();
  await expect(second).toHaveClass(/hl/);
  await expect(second).toContainText('cashbox handle');
  // The new search term no longer matches the first part, so its row is gone, not just unhighlighted.
  await expect(first).toHaveCount(0);
});

// A hash that isn't a part number — the skip link's #main, in particular — must not hijack the
// search: it's a same-document anchor, so it reaches PartsList exactly like a part hash does.
test('a non-part hash such as #main leaves Parts search alone', async ({ page }) => {
  await gotoHydrated(page, '/parts#main');
  await expect(page.getByLabel('Search parts')).toHaveValue('');
  await expect(page.locator('.count')).toContainText('Top-level assemblies');

  await page.evaluate(() => {
    location.hash = '#main';
  });
  await expect(page.getByLabel('Search parts')).toHaveValue('');
  await expect(page.locator('.count')).toContainText('Top-level assemblies');
});

/* P1 item 3 of the app audit, round 3: a handbook table's codes never break at a hyphen, and its
   scroller is a region the keyboard can reach, named after the heading it sits under (VP3-01,
   AY3-02). */
test.describe('handbook tables', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 900 });
    await gotoHydrated(page, '/handbook/quick');
  });

  test('codes stay whole on a phone and every scroller is a named region', async ({ page }) => {
    const toks = page.locator('.prose td .tok');
    expect(await toks.count()).toBeGreaterThan(50);
    const broken = await toks.evaluateAll((els) =>
      els.filter((el) => el.getClientRects().length > 1).map((el) => el.textContent),
    );
    expect(broken).toEqual([]);
    const regions = await page.locator('.prose .scroll-x').evaluateAll((els) =>
      els.map((el) => ({
        tabindex: el.getAttribute('tabindex'),
        role: el.getAttribute('role'),
        name: el.getAttribute('aria-label') ?? '',
      })),
    );
    expect(regions.length).toBeGreaterThan(5);
    for (const r of regions) {
      expect(r.tabindex).toBe('0');
      expect(r.role).toBe('region');
      expect(r.name.length).toBeGreaterThan(0);
    }
    expect(regions.map((r) => r.name)).toEqual(
      expect.arrayContaining(['Jumper Charts, table 1', 'Jumper Charts, table 2', 'Flippers']),
    );
  });

  test('the arrow keys scroll a focused table', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'axe.spec proves the focusable region on WebKit');
    const name = await page
      .locator('.prose .scroll-x')
      .evaluateAll(
        (els) =>
          els.find((el) => el.scrollWidth > el.clientWidth + 8)?.getAttribute('aria-label') ?? '',
      );
    expect(name).not.toBe('');
    const region = page.getByRole('region', { name, exact: true });
    await region.focus();
    await expect(region).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  });
});
