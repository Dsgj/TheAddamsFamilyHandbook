import { expect, test, type Page } from '@playwright/test';
import { activate, gotoHydrated, swReady } from './helpers';

/* Phase 11 of the app redesign: the toasts, the Install sheet, the scan-not-cached state and the
   Workshop's pull-to-refresh. The tests raise toasts with the same `tafh:toast` event pwa.ts uses. */

const raise = (page: Page, kind: string, text: string) =>
  page.evaluate(
    ([kind, text]) =>
      window.dispatchEvent(new CustomEvent('tafh:toast', { detail: { kind, text } })),
    [kind, text],
  );

test.describe('toasts', () => {
  // The real service worker raises its own "Ready to work offline" toast about 3 s after the first
  // load, which restarts the 4 s dwell under a raised one (CI run 37108543689). Blocked, the only
  // toasts are the ones a test raises.
  test.use({ serviceWorkers: 'block' });

  test('one at a time; Update outlasts the others and is back after their 4 s dwell', async ({
    page,
  }) => {
    await page.clock.install();
    await gotoHydrated(page, '/tables');
    await raise(page, 'offline', 'Ready to work offline. Manual pages are saved as you open them.');
    await raise(page, 'update', 'A new version of the app is ready.');
    const toast = page.locator('.toast');
    await expect(toast).toHaveCount(1);
    await expect(toast).toContainText('A new version of the app is ready.');
    await expect(toast.getByRole('button', { name: 'Reload' })).toBeVisible();
    // A shorter toast raised under Update is not dropped: it takes its 4 s, so "not saving" is
    // never lost to an update (CO3-04); then Update is back, with Reload, and stays.
    await raise(
      page,
      'info',
      'This device is not saving changes. They last until you leave this page.',
    );
    await expect(toast).toHaveCount(1);
    await expect(toast).toContainText('This device is not saving changes.');
    await expect(toast.getByRole('button', { name: 'Reload' })).toHaveCount(0);
    // Past the 4 s dwell of a non-update toast (Toast.svelte), on the fake clock.
    await page.clock.runFor(4500);
    await expect(toast).toContainText('A new version of the app is ready.');
    await expect(toast.getByRole('button', { name: 'Reload' })).toBeVisible();
    await page.clock.runFor(4500);
    await expect(toast).toContainText('A new version of the app is ready.');
    // The host is a live region, never a status role.
    await expect(page.locator('.toast-host')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('.toast-host[role]')).toHaveCount(0);
  });

  test('the offline toast is gone after 4 s', async ({ page }) => {
    await page.clock.install();
    await gotoHydrated(page, '/tables');
    // Installed, the clock still flows with real time (the page loads on it); paused, the dwell
    // counts only the fake time below. Flowing, a slow WebKit runner spent the last 100 ms of the
    // dwell between the raise and the first runFor (CI run 37188520290).
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await raise(page, 'offline', 'Ready to work offline.');
    const toast = page.locator('.toast', { hasText: 'Ready to work offline.' });
    await expect(toast).toBeVisible();
    // the 4 s dwell (Toast.svelte) on the fake clock: up just before it ends, gone just after
    await page.clock.runFor(3900);
    await expect(toast).toBeVisible();
    await page.clock.runFor(200);
    await expect(toast).toBeHidden();
  });

  for (const path of ['/care', '/setup', '/shopping']) {
    test(`an update toast on ${path} adds no status role`, async ({ page }) => {
      await gotoHydrated(page, path);
      const before = await page.getByRole('status').count();
      await raise(page, 'update', 'A new version of the app is ready.');
      await expect(page.locator('.toast')).toBeVisible();
      await expect(page.getByRole('status')).toHaveCount(before);
    });
  }

  test('a tab under the toast host still takes the tap', async ({ page }) => {
    await gotoHydrated(page, '/tables');
    await raise(page, 'update', 'A new version of the app is ready.');
    await expect(page.locator('.toast')).toBeVisible();
    await page.getByRole('link', { name: 'Workshop' }).first().click();
    await expect(page).toHaveURL(/\/workshop$/);
  });
});

test.describe('the update check offline (PF3-03)', () => {
  // No worker, so no "Ready to work offline" toast lands on top of this one.
  test.use({ serviceWorkers: 'block' });

  test('a check for updates while offline says so, not "up to date"', async ({ page, context }) => {
    await gotoHydrated(page, '/workshop');
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('tafh:check-update')));
    await expect(page.locator('.toast')).toContainText(
      'You are offline, so the app could not check for an update.',
    );
    await context.setOffline(false);
  });
});

test('a first install that ends on the next page still says "Ready to work offline" (PF3-01)', async ({
  page,
}) => {
  await gotoHydrated(page, '/tables');
  await swReady(page);
  // As pwa.ts leaves it on the page where the install began and the user moved on.
  await page.evaluate(() => sessionStorage.setItem('tafh:install', '1'));
  await gotoHydrated(page, '/workshop');
  await expect(page.locator('.toast[data-kind="offline"]')).toContainText('Ready to work offline.');
  expect(await page.evaluate(() => sessionStorage.getItem('tafh:install'))).toBeNull();
  // Said once: the page after it is quiet.
  await gotoHydrated(page, '/tables');
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('a passive component view with storage blocked raises no toast; a note still does (CO3-04)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  // Opening the page writes the Viewed list: the app's bookkeeping, so no warning.
  await gotoHydrated(page, '/switch/32');
  await expect(page.locator('.toast')).toHaveCount(0);
  // The user's own note is the first write that warns, and the page's one warning was unspent.
  await page.getByRole('textbox', { name: 'Note' }).fill('wire loose at the lug');
  await expect(page.locator('.toast')).toContainText('This device is not saving changes.');
  expect(errors).toEqual([]);
});

test('the uncached-page card goes when the connection returns; Rotate hides meanwhile (PF3-07)', async ({
  page,
  context,
  browserName,
}) => {
  let offline = true;
  await page.route('**/assets/pages/**', (r) => (offline ? r.abort() : r.fallback()));
  await gotoHydrated(page, '/manual/ops/40');
  const card = page.getByText("This manual page isn't on the device yet.");
  await expect(card).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rotate page' })).toHaveCount(0);
  // The connection returns: the browser's `online` event asks for the scan again.
  offline = false;
  await context.setOffline(true);
  await context.setOffline(false);
  // Playwright's WebKit emulates `navigator.onLine` without the window's `online` event; raise it.
  if (browserName === 'webkit')
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(card).toBeHidden();
  await expect(page.locator('.stage')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Rotate page' })).toBeVisible();
});

test('an uncached manual page says so offline; "Show the text" reveals its text', async ({
  page,
}) => {
  // Without a network the scan request fails the same way; aborting it is the deterministic form.
  await page.route('**/assets/pages/**', (r) => r.abort());
  await gotoHydrated(page, '/manual/ops/40');
  await expect(page.getByText("This manual page isn't on the device yet.")).toBeVisible();
  // No empty frame and no zoom for a scan that is not there (PF2-07).
  await expect(page.locator('.stage')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Zoom' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show the text' }).click();
  await expect(page.locator('.text pre')).toBeVisible();
});

test.describe('data files that do not load (AR2-03, CO2-06, SV2-02)', () => {
  // The page's own requests, not the worker's precache, so a route can fail them.
  test.use({ serviceWorkers: 'block' });

  test('the parts list says it did not load, and Retry loads it', async ({ page }) => {
    let fail = true;
    await page.route('**/data/parts.json', (r) => (fail ? r.abort() : r.fallback()));
    await gotoHydrated(page, '/parts');
    await expect(page.locator('.count')).toHaveText('The parts list did not load.');
    fail = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('.count')).toContainText('Top-level assemblies');
  });

  test('the manuals search survives a ?q that is no escape, and a text that did not load', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    let fail = true;
    await page.route('**/data/ocr-text.json', (r) => (fail ? r.abort() : r.fallback()));
    await gotoHydrated(page, '/manual?q=100%');
    await expect(page.getByLabel('Search the manuals')).toHaveValue('100%');
    await expect(page.getByText("The manuals' text did not load.")).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText("The manuals' text did not load.")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a Diagnose search fetches each file once', async ({ page }) => {
    const seen: Record<string, number> = {};
    page.on('request', (r) => {
      const m = /\/data\/([\w-]+\.json)/.exec(r.url());
      if (m) seen[m[1]!] = (seen[m[1]!] ?? 0) + 1;
    });
    await gotoHydrated(page, '/');
    await page.getByLabel('Test report or display message').fill('flipper');
    await expect(page.locator('.qs .lst-h', { hasText: 'Manuals' })).toBeVisible();
    await expect(page.locator('.qs .lst-h', { hasText: 'Parts' })).toBeVisible();
    expect(seen).toEqual({ 'handbook.json': 1, 'ocr-text.json': 1, 'parts.json': 1 });
  });
});

test('an Update ready said before the toast host hydrated still shows, with Reload (PF2-03)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.tafhToast = { kind: 'update', text: 'A new version of the app is ready.' };
  });
  await gotoHydrated(page, '/workshop');
  const t = page.locator('.toast[data-kind="update"]');
  await expect(t).toContainText('A new version of the app is ready.');
  await expect(t.getByRole('button', { name: 'Reload' })).toBeVisible();
});

test('a dismissed install prompt is spent; a fresh one brings Install back (CO2-09)', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { offer: (o: string) => void; prompts: number };
    w.prompts = 0;
    w.offer = (outcome) => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(e, {
        prompt: () => {
          w.prompts++;
          return Promise.resolve();
        },
        userChoice: Promise.resolve({ outcome }),
      });
      window.dispatchEvent(e);
    };
  });
  const prompts = () => page.evaluate(() => (window as unknown as { prompts: number }).prompts);
  await gotoHydrated(page, '/workshop');
  await page.evaluate(() =>
    (window as unknown as { offer: (o: string) => void }).offer('dismissed'),
  );
  await page.getByRole('button', { name: 'Install the app' }).click();
  const dialog = page.getByRole('dialog', { name: 'Install the app' });
  const install = dialog.getByRole('button', { name: 'Install', exact: true });
  await install.click();
  expect(await prompts()).toBe(1);
  await expect(install).toHaveCount(0);
  await page.evaluate(() =>
    (window as unknown as { offer: (o: string) => void }).offer('accepted'),
  );
  await install.click();
  expect(await prompts()).toBe(2);
  await expect(dialog).toHaveCount(0);
});

test('the Install sheet opens from the Workshop, closes on Esc and returns focus', async ({
  page,
  browserName,
}) => {
  await gotoHydrated(page, '/workshop');
  const open = page.getByRole('button', { name: 'Install the app' });
  await activate(open, browserName);
  const dialog = page.getByRole('dialog', { name: 'Install the app' });
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
  // A first visit's worker may still be installing; the check says so instead of "up to date" (PF2-08).
  await expect(page.locator('.toast')).toContainText(
    /The app is up to date\.|A new version of the app is ready\.|Downloading an update\./,
    { timeout: 8000 },
  );
});

/* P0 items 2 and 6 of the app audit: every query string used to miss the precache offline
   (default `ignoreURLParametersMatching`), and the handbook's JPG figures were never cached at
   all (the glob only covered PNGs). The paths are relative to baseURL, so the test also runs on
   the production sub-path (`BASE_PATH=/valvet/`), where the home used to be keyed `/valvet` and
   missed the precache (src/lib/precache.ts). */
test(
  'offline, a query string still hits the precache and a handbook photo still decodes',
  { tag: '@subpath' },
  async ({ page, context, browserName }) => {
    test.skip(
      browserName === 'webkit',
      "offline navigation is an internal error in Playwright's WebKit",
    );
    await gotoHydrated(page, './');
    // The SW only becomes active once install (which precaches everything) has finished.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await context.setOffline(true);

    // motion.ts writes the Diagnose tab's href as `/?q=…` once a search has been made.
    await gotoHydrated(page, './?q=32');
    await expect(page.locator('.rh')).toHaveText('1 code');

    // motion.ts writes the Map tab's href the same way once a marker has been picked.
    await gotoHydrated(page, './map?layer=sw&id=32');
    // The phone sheet is named for the switch; the desktop panel's card heads with the part's
    // name, with no "Switch 32" heading above it (P2 item 8 of the app audit, round 3).
    await expect(
      page
        .locator('.sheet.map[aria-label="Selected component, Switch 32"]')
        .or(page.getByRole('complementary').getByRole('heading', { name: 'Upper Right Jet' })),
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
  },
);
