import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

/* Phase 11 of the app redesign: the toasts, the Install sheet, the scan-not-cached state and the
   Workshop's pull-to-refresh. The tests raise toasts with the same `tafh:toast` event pwa.ts uses. */

const raise = (page: Page, kind: string, text: string) =>
  page.evaluate(
    ([kind, text]) =>
      window.dispatchEvent(new CustomEvent('tafh:toast', { detail: { kind, text } })),
    [kind, text],
  );

test.describe('toasts', () => {
  test('one at a time, Update wins, offline leaves after 4 s, update stays', async ({ page }) => {
    await gotoHydrated(page, '/tables');
    await raise(page, 'offline', 'Ready to work offline. Scans are cached as you open them.');
    await raise(page, 'update', 'A new version of the handbook is ready.');
    await raise(page, 'offline', 'Ready to work offline. Scans are cached as you open them.');
    const toast = page.locator('.toast');
    await expect(toast).toHaveCount(1);
    await expect(toast).toContainText('A new version of the handbook is ready.');
    await expect(toast.getByRole('button', { name: 'Reload' })).toBeVisible();
    await page.waitForTimeout(4500);
    await expect(toast).toContainText('A new version of the handbook is ready.');
    // The host is a live region, never a status role.
    await expect(page.locator('.toast-host')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('.toast-host[role]')).toHaveCount(0);
  });

  test('the offline toast is gone after 4 s', async ({ page }) => {
    await gotoHydrated(page, '/tables');
    await raise(page, 'offline', 'Ready to work offline.');
    const toast = page.locator('.toast', { hasText: 'Ready to work offline.' });
    await expect(toast).toBeVisible();
    await expect(toast).toBeHidden({ timeout: 6000 });
  });

  for (const path of ['/care', '/setup', '/shopping']) {
    test(`an update toast on ${path} adds no status role`, async ({ page }) => {
      await gotoHydrated(page, path);
      const before = await page.getByRole('status').count();
      await raise(page, 'update', 'A new version of the handbook is ready.');
      await expect(page.locator('.toast')).toBeVisible();
      expect(await page.getByRole('status').count()).toBe(before);
    });
  }

  test('a tab under the toast host still takes the tap', async ({ page }) => {
    await gotoHydrated(page, '/tables');
    await raise(page, 'update', 'A new version of the handbook is ready.');
    await expect(page.locator('.toast')).toBeVisible();
    await page.getByRole('link', { name: 'Workshop' }).first().click();
    await expect(page).toHaveURL(/\/workshop$/);
  });
});

test('an uncached scan says so offline, and "Show the text" reveals the OCR', async ({ page }) => {
  // Without a network the scan request fails the same way; aborting it is the deterministic form.
  await page.route('**/assets/pages/**', (r) => r.abort());
  await gotoHydrated(page, '/manual/ops/40');
  await expect(page.getByText("This scan isn't on the device yet.")).toBeVisible();
  await page.getByRole('button', { name: 'Show the text' }).click();
  await expect(page.locator('.text pre')).toBeVisible();
});

test('the Install sheet opens from the Workshop, closes on Esc and returns focus', async ({
  page,
}) => {
  await gotoHydrated(page, '/workshop');
  const open = page.getByRole('button', { name: 'Install the handbook' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Install the handbook' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Opens without the browser bar')).toBeVisible();
  await expect(dialog.getByText('On iPhone: tap Share, then Add to Home Screen.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('pull-to-refresh lives on the Workshop only and ends in a toast', async ({ page }) => {
  await gotoHydrated(page, '/tables');
  await expect(page.locator('[data-ptr]')).toHaveCount(0);
  await gotoHydrated(page, '/workshop');
  await expect(page.locator('[data-ptr]')).toHaveCount(1);
  // A first visit may still be showing "Ready to work offline"; let it leave first.
  await expect(page.locator('.toast[data-kind="offline"]')).toHaveCount(0, { timeout: 8000 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tafh:check-update')));
  await expect(page.locator('.toast')).toContainText(
    /The handbook is up to date\.|A new version of the handbook is ready\./,
    { timeout: 8000 },
  );
});

/* P0 items 2 and 6 of the app audit: every query string used to miss the precache offline
   (default `ignoreURLParametersMatching`), and the handbook's JPG figures were never cached at
   all (the glob only covered PNGs). The paths are relative to baseURL, so the test also runs on
   the production sub-path (`BASE_PATH=/valvet/`), where the home used to be keyed `/valvet` and
   missed the precache (src/lib/precache.ts). */
test('offline, a query string still hits the precache and a handbook photo still decodes', async ({
  page,
  context,
}) => {
  await gotoHydrated(page, './');
  // The SW only becomes active once install (which precaches everything) has finished.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await context.setOffline(true);

  // motion.ts writes the Diagnose tab's href as `/?q=…` once a search has been made.
  await gotoHydrated(page, './?q=32');
  await expect(page.locator('.rh')).toHaveText('1 code');

  // motion.ts writes the Map tab's href the same way once a marker has been picked.
  await gotoHydrated(page, './map?layer=sw&id=32');
  await expect(
    page
      .locator('.t-title', { hasText: 'Switch 32' })
      .or(page.locator('.sheet.map[aria-label="Selected part, Switch 32"]')),
  ).toBeVisible();

  // The appendix is the one handbook section with photos (JPGs) rather than scan diagrams (PNGs).
  await gotoHydrated(page, './handbook/appendix');
  const photo = page.locator('figure.photo img').first();
  await photo.scrollIntoViewIfNeeded();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  // PF-12: a route the precache doesn't know (a typo, a section removed since this SW was built)
  // gets the branded 404 page offline, not the browser's error page.
  for (const path of ['./nope', './handbook/']) {
    await page.goto(path);
    await expect(page).toHaveTitle(/^Not found/);
    await expect(page.locator('a', { hasText: 'Back to Diagnose' })).toBeVisible();
  }

  await context.setOffline(false);
});
