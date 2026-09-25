import { expect, test, type Page } from '@playwright/test';
import { gotoHydrated } from './helpers';

/* Phase 6 of the app redesign: the Diagnose home, its results and its search state. */

const FIELD = 'Test report or display message';
const field = (page: Page) => page.getByLabel(FIELD);
const box = async (page: Page, sel: string) => {
  const b = await page.locator(sel).first().boundingBox();
  expect(b, sel).not.toBeNull();
  return b!;
};

test.describe('home on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('quick links, examples, the field and Diagnose fit without scrolling', async ({ page }) => {
    await gotoHydrated(page, '/');
    const tiles = page.getByRole('navigation', { name: 'Quick links' }).getByRole('link');
    await expect(tiles).toHaveText(['Playfield map', 'Switch matrix', 'Lamp matrix']);
    for (const t of ['32 68 F1 F3', 'Check Switch 32', 'L11 L12 L13', 'SOL 7'])
      await expect(page.getByRole('button', { name: t })).toBeVisible();
    await expect(field(page)).toHaveValue('');
    await expect(field(page)).toHaveAttribute('placeholder', '32 68 F1 F3');
    const go = await box(page, 'button:has-text("Diagnose")');
    const bar = await box(page, 'nav.shell');
    // Everything above the tab bar, no scrolling needed; the button within thumb reach.
    expect(go.y + go.height).toBeLessThanOrEqual(bar.y);
    expect(go.y + go.height / 2).toBeGreaterThan(844 / 2);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    const f = await box(page, '#codes');
    expect(f.y + f.height).toBeLessThanOrEqual(bar.y);
    await expect(page.getByText('Or type a word to search everything.')).toBeVisible();
  });

  test('tapping an example diagnoses it with no button pressed', async ({ page }) => {
    await gotoHydrated(page, '/');
    await page.getByRole('button', { name: '32 68 F1 F3' }).click();
    await expect(page.locator('article.comp')).toHaveCount(4);
    await expect(page.getByText('Shared cause?')).toBeVisible();
    await expect(page.getByText(/J806/).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: '4 codes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share results' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear', exact: true })).toBeVisible();
  });

  test('Diagnose records the entry in Recent; typing alone records nothing', async ({ page }) => {
    await gotoHydrated(page, '/');
    await field(page).fill('32 68');
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'Try' })).toBeVisible();
    await expect(page.getByRole('button', { name: '32 68', exact: true })).toHaveCount(0);

    await field(page).fill('32 68');
    // The results replace the home while typing; let the layout settle before the tap.
    await expect(page.getByRole('heading', { level: 2, name: '2 codes' })).toBeVisible();
    await page.getByRole('button', { name: 'Diagnose' }).click();
    await expect(page.getByRole('heading', { level: 2, name: '2 codes' })).toBeFocused();
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'Recent' })).toBeVisible();
    const rows = page.locator('.recent .lrow');
    await expect(rows.first()).toContainText('32 68');
    await expect(rows.first()).toContainText('2 switches');
    await expect(rows.first()).toContainText('Today');
    // Choosing it refills the field.
    await rows.first().click();
    await expect(field(page)).toHaveValue('32 68');
    await expect(page.locator('article.comp')).toHaveCount(2);
  });

  test('Enter in a one-line field records too, and the same input moves to the top', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    await field(page).fill('L11');
    await field(page).press('Enter');
    await expect(field(page)).toHaveValue('L11');
    await field(page).fill('SOL 7');
    await field(page).press('Enter');
    await field(page).fill('l11');
    await field(page).press('Enter');
    await page.reload();
    const rows = page.locator('.recent .lrow');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('l11');
    await expect(rows.nth(0)).toContainText('1 lamp');
    await expect(rows.nth(1)).toContainText('SOL 7');
    await expect(rows.nth(1)).toContainText('1 solenoid');
  });

  test('leaving the field with a recognised code records; the Recent list can be cleared', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    await field(page).fill('Check Switch 68');
    await page.getByRole('button', { name: 'Fault' }).click();
    await page.getByRole('heading', { level: 2, name: '1 code' }).click();
    await page.reload();
    const row = page.locator('.recent .lrow').first();
    await expect(row).toContainText('Check Switch 68');
    await expect(row).toContainText('1 switch · 1 marked Fault');
    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Try' })).toBeVisible();
  });

  test('the bar button "Recent reports" returns to the home and focuses the list', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    await field(page).fill('32');
    await expect(page.locator('article.comp')).toHaveCount(1);
    await page.getByRole('button', { name: 'Recent reports' }).click();
    // The tap blurred the field, so "32" was recorded and the list is now Recent.
    await expect(page.getByRole('heading', { level: 2, name: 'Recent' })).toBeFocused();
    await expect(field(page)).toHaveValue('');
  });

  test('?q= still fills the field', async ({ page }) => {
    await gotoHydrated(page, '/?q=32');
    await expect(field(page)).toHaveValue('32');
    await expect(page.locator('article.comp[data-id="32"]')).toBeVisible();
  });
});

test.describe('search', () => {
  test('a word searches everything; Cancel restores the home', async ({ page }) => {
    await gotoHydrated(page, '/');
    await field(page).fill('flipper');
    const chips = page.getByRole('group', { name: 'Search in' }).getByRole('button');
    await expect(chips).toHaveText(['All', 'Components', 'Handbook', 'Manuals', 'Parts']);
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('heading', { level: 3, name: /^Components/ })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Right Flipper End of Stroke Switch/ }).first(),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: /^Parts/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /flipper ring-red/ }).first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: /^Handbook/ })).toBeVisible();
    await expect(page.locator('article.comp')).toHaveCount(0);
    await expect(page.locator('.prov')).toHaveCount(0);
    // Components shows five, then all of them.
    const comps = page.locator('.lst').first().locator('a.lrow');
    await expect(comps).toHaveCount(5);
    await page.getByRole('button', { name: /^Show all \d+ components/ }).click();
    expect(await comps.count()).toBeGreaterThan(5);
    // A chip narrows to one group.
    await chips.filter({ hasText: 'Parts' }).click();
    await expect(page.getByRole('heading', { level: 3, name: /^Components/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 3, name: /^Parts/ })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(field(page)).toHaveValue('');
    await expect(page.getByRole('navigation', { name: 'Quick links' })).toBeVisible();
  });

  test('"Clear search" empties the field and keeps focus in it', async ({ page }) => {
    await gotoHydrated(page, '/');
    await field(page).fill('vault');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(field(page)).toHaveValue('');
    await expect(field(page)).toBeFocused();
  });

  for (const text of ['row 5', 'Check Switch 32', 'f', 'TEST REPORT\nSWITCH 32']) {
    test(`${JSON.stringify(text)} never shows the search state`, async ({ page }) => {
      await gotoHydrated(page, '/');
      await field(page).fill(text);
      await expect(page.getByRole('group', { name: 'Search in' })).toHaveCount(0);
    });
  }

  test('"row 5" still says Not recognised and "Check Switch 32" still diagnoses', async ({
    page,
  }) => {
    await gotoHydrated(page, '/');
    await field(page).fill('row 5');
    await expect(page.locator('.prov')).toContainText('Not recognised');
    await field(page).fill('Check Switch 32');
    await expect(page.locator('article.comp[data-id="32"] h2')).toContainText('Upper Right Jet');
  });
});

test.describe('the old home links live in their hubs', () => {
  for (const [hub, targets] of [
    ['/handbook', ['handbook/tests', 'handbook/errors']],
    ['/tables', ['fuses']],
    ['/workshop', ['verify', 'setup', 'care']],
  ] as const) {
    test(`${hub} links to ${targets.join(', ')}`, async ({ page }) => {
      await gotoHydrated(page, hub);
      // The hub's own rows; the handbook's TOC widget (rebuilt in Phase 8) is not counted.
      for (const t of targets)
        await expect
          .poll(() =>
            page.evaluate(
              (t) =>
                [...document.querySelectorAll(`main a[href$="${t}"]`)].filter(
                  (a) => !a.closest('nav.toc'),
                ).length,
              t,
            ),
          )
          .toBe(1);
    });
  }

  test('/ carries none of them any more', async ({ page }) => {
    await gotoHydrated(page, '/');
    for (const t of ['handbook/tests', 'handbook/errors', 'fuses', 'verify', 'setup', 'care'])
      await expect(page.locator(`main a[href$="${t}"]`)).toHaveCount(0);
  });
});

test.describe('the result card', () => {
  test('carries the spec anatomy and keeps its contracts', async ({ page }) => {
    await gotoHydrated(page, '/?q=32');
    const card = page.locator('article.comp[data-id="32"]');
    await expect(card.locator('.code.lg')).toHaveText('32');
    await expect(card.locator('h2')).toContainText('Upper Right Jet');
    await expect(card.locator('.kind')).toContainText('Switch · matrix column');
    await expect(card.getByRole('link', { name: 'Open on the map' })).toBeVisible();
    await expect(card.getByRole('group', { name: 'Test status' }).getByRole('button')).toHaveText([
      'OK',
      'Fault',
      'Not tested',
    ]);
    await expect(card.getByRole('link', { name: 'Show on map' })).toHaveAttribute(
      'href',
      /map\?layer=sw&id=32$/,
    );
    await expect(card.getByRole('link', { name: 'Details' })).toHaveAttribute(
      'href',
      /switch\/32$/,
    );
    await expect(card.locator('.acts').getByRole('link', { name: /^p\. 2-/ })).toBeVisible();
  });
});
