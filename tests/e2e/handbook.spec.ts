import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

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
    await expect(page.getByRole('link', { name: /^Test menu/ })).toContainText('1-15–1-19');
    await expect(page.getByRole('link', { name: /A6.*Flippers/ })).toHaveAttribute(
      'href',
      /handbook\/appendix#p106-1$/,
    );
    await expect(page.getByText("The owner's own notes, not manual text.")).toBeVisible();
    await expect(page.getByText(/Pages 1-16 to 1-18 are transcribed/)).toBeVisible();
    await expect(page.locator('[data-continue]')).toBeHidden();

    const field = page.getByLabel('Search the handbook and scans');
    await expect(page.locator('nav.toc ul')).toHaveCount(0);
    await field.fill('flipper');
    await expect(page.locator('nav.toc li a').first()).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Search the scans for “flipper”' }),
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

  test('"Search the scans" hands the query to the manual search', async ({ page }) => {
    await gotoHydrated(page, '/manual?q=flipper');
    await expect(page.getByLabel('Search manual text')).toHaveValue('flipper');
    await expect(page.locator('.search a[href*="/manual/"]').first()).toBeVisible();
  });
});

test.describe('the reader', () => {
  test('has the back link, View the scan and the bottom toolbar; Contents opens a sheet', async ({
    page,
  }) => {
    await gotoHydrated(page, '/handbook/tests');
    await expect(page.locator('header.top a.back')).toHaveText('Handbook');
    await expect(page.getByRole('link', { name: 'View the scan' })).toHaveAttribute(
      'href',
      /manual\/ops\/25$/,
    );
    const bar = page.getByRole('navigation', { name: 'Reader' });
    await expect(bar.getByRole('link', { name: 'Previous: Menu system & bookkeeping' })).toHaveText(
      '1-14',
    );
    await expect(bar.getByRole('link', { name: 'Next: Utilities' })).toHaveText('1-20');
    await expect(page.locator('.pg-bar').first()).toContainText('p. 1-15');

    const contents = bar.getByRole('button', { name: 'Contents' });
    await contents.click();
    const dialog = page.getByRole('dialog', { name: 'Contents' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Filter contents')).toBeVisible();
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
});

test.describe('the manual viewer', () => {
  test('the toolbar pages, "97 / 124" opens Go to page, and 30 + Go lands on page 30', async ({
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
    await expect(page.getByRole('heading', { level: 2, name: 'Contents' })).toBeVisible();
    await expect(page.locator('.lst a[aria-current="true"]')).toHaveCount(1);
    await expect(page.getByText('Scans are saved on the device as you open them.')).toBeVisible();

    const open = tb.getByRole('button', { name: 'Go to page (97 of 124)' });
    await expect(open).toHaveText('97 / 124');
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

  test('Esc closes Go to page and returns focus; a printed number also works', async ({ page }) => {
    await gotoHydrated(page, '/manual/ops/97');
    const open = page.getByRole('button', { name: /^Go to page/ });
    await open.click();
    await expect(page.getByRole('dialog', { name: 'Go to page' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(open).toBeFocused();
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Go to page' });
    await dialog.getByLabel('Page').fill('2-39');
    await dialog.getByRole('button', { name: 'Go' }).click();
    await expect(page).toHaveURL(/manual\/ops\/97$/);
  });

  test('zoom capsule and Rotate page act on the scan; the keys still work', async ({ page }) => {
    await gotoHydrated(page, '/manual/ops/25');
    const scan = page.locator('.sheet.scan');
    await expect(page.locator('.stage img').first()).toBeVisible();
    const fitW = (await scan.boundingBox())!.width;
    const zoom = page.getByRole('group', { name: 'Zoom' });
    for (const name of ['Zoom in', 'Zoom out', 'Fit']) {
      const b = (await zoom.getByRole('button', { name }).boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    await zoom.getByRole('button', { name: 'Zoom in' }).click();
    await expect.poll(async () => (await scan.boundingBox())!.width).toBeGreaterThan(fitW + 1);
    await zoom.getByRole('button', { name: 'Fit' }).click();
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

  test('"Search manual text" is on /manual and on the viewer page', async ({ page }) => {
    await gotoHydrated(page, '/manual');
    await expect(page.getByLabel('Search manual text')).toBeVisible();
    await gotoHydrated(page, '/manual/ops/25');
    await page.getByLabel('Search manual text').scrollIntoViewIfNeeded();
    await expect(page.getByLabel('Search manual text')).toBeVisible();
    await expect(page.getByRole('link', { name: /Read the transcription/ })).toHaveAttribute(
      'href',
      /handbook\/tests#pg-25$/,
    );
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
  await expect(page.getByText(/Descriptions are OCR from the original/)).toBeVisible();
  await page.getByLabel('Search parts').fill('flipper');
  await expect(page.locator('.count')).toHaveText(/^\d+ rows/);
  await expect(page.locator('tbody tr').first()).toContainText(/flipper/i);
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByLabel('Search parts')).toHaveValue('');
  await expect(page.getByLabel('Search parts')).toBeFocused();
  await expect(page.locator('.count')).toContainText('Top-level assemblies');
});
