import { expect, test } from '@playwright/test';
import { activate, gotoHydrated } from './helpers';

/* Phase 7 of the app redesign: the switch matrix tabs, the matrix cell card, the component detail
   page with its Show-on-map sheet, and Recently viewed on the Tables hub. */

test.describe('the switch matrix tabs', () => {
  test('the tablist moves aria-selected with a click and the arrow keys', async ({ page }) => {
    await gotoHydrated(page, '/switches');
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveText(['Matrix', 'Dedicated', 'Flippers']);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-matrix')).toBeVisible();
    await expect(page.locator('#panel-j205')).toBeHidden();
    for (const t of ['tab-matrix', 'tab-j205', 'tab-j806']) {
      await expect(page.locator(`#${t}`)).toHaveAttribute(
        'aria-controls',
        t.replace('tab-', 'panel-'),
      );
    }

    await page.getByRole('tab', { name: 'Dedicated' }).click();
    await expect(page.getByRole('tab', { name: 'Dedicated' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#panel-j205')).toBeVisible();
    await expect(page.locator('#panel-matrix')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Dedicated switches (J205)' })).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Flippers' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Flippers' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#panel-j806')).toBeVisible();
    // The buttons are wired to J805 and the EOS switches to J806 (components.json pins).
    await expect(
      page.getByRole('heading', { name: 'Flipper switches (Fliptronics J805/J806)' }),
    ).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Matrix' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('End');
    await expect(page.locator('#panel-j806')).toBeVisible();
  });

  test('every Fault tick is in the DOM on a fresh load and keeps its stored state', async ({
    page,
  }) => {
    await gotoHydrated(page, '/switches');
    await expect(page.locator('input.fault-check')).toHaveCount(16);
    await page.getByRole('tab', { name: 'Flippers' }).click();
    await page.getByLabel('Fault: Left Flipper Button').check();
    await page.reload();
    // The tick in the hidden panel is restored on import, before the tab is opened.
    await expect(page.locator('input.fault-check:checked')).toHaveCount(1);
    await expect(page.locator('input.fault-check:checked')).toHaveAttribute(
      'aria-label',
      'Fault: Left Flipper Button',
    );
  });

  test('a focused cell shows its card with Details and Show on map', async ({ page }) => {
    await gotoHydrated(page, '/switches');
    await expect(page.locator('[data-cell-card]')).toHaveCount(0);
    await page.locator('[data-cell="32"]').focus();
    const card = page.locator('[data-cell-card="32"]');
    await expect(card).toBeVisible();
    await expect(card.locator('.code.lg')).toHaveText('32');
    await expect(card.locator('h2')).toHaveText('Upper Right Jet');
    await expect(card).toContainText('matrix column 3, row 2');
    await expect(card.getByRole('link', { name: 'Details' })).toHaveAttribute(
      'href',
      /switch\/32$/,
    );
    await expect(card.getByRole('link', { name: 'Show on map' })).toHaveAttribute(
      'href',
      /map\?layer=sw&id=32$/,
    );
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-cell-card="42"]')).toBeVisible();
  });

  test('a hash that is no URI escape is no cell, not a page error (CO3-06)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await gotoHydrated(page, '/switches#c%E0');
    await expect(page.locator('[data-cell="32"]')).toBeVisible();
    await expect(page.locator('[data-cell="32"]')).not.toHaveClass(/target/);
    expect(errors).toEqual([]);
  });

  test('a link to one part lands on its cell, its panel or its row (UX2-07)', async ({ page }) => {
    await gotoHydrated(page, '/switches#c32');
    await expect(page.locator('[data-cell="32"]')).toBeFocused();
    await expect(page.locator('[data-cell="32"]')).toHaveClass(/target/);
    await expect(page.locator('[data-cell-card="32"] h2')).toHaveText('Upper Right Jet');
    await expect(page.locator('[data-cell-card="32"]')).toBeInViewport();
    // A switch the map does not draw says so on its card instead of Show on map (UX2-05).
    await page.locator('[data-cell="14"]').focus();
    const tilt = page.locator('[data-cell-card="14"]');
    await expect(tilt.getByRole('link', { name: 'Show on map' })).toHaveCount(0);
    await expect(tilt).toContainText(
      'Not on the playfield map: on the coin door or in the cabinet.',
    );
    await gotoHydrated(page, '/coils#coil-01');
    await expect(page.locator('#coil-01')).toBeInViewport();
    await expect(page.locator('#coil-01')).toContainText('Chair Kickout');
    // Another page in between: a hash on the same page would not load it again.
    await gotoHydrated(page, '/switches#j205');
    await expect(page.getByRole('tab', { name: 'Dedicated' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // A flipper coil row has its own anchor and links its page (CR3-02).
    await gotoHydrated(page, '/coils#flipper-ULF');
    const ulf = page.locator('#flipper-ULF');
    await expect(ulf).toBeInViewport();
    await expect(ulf.getByRole('link', { name: 'ULF' })).toHaveAttribute('href', /flipper\/ULF$/);
    await expect(ulf.getByLabel('Fault: Upper Left Flipper')).toBeVisible();
  });
});

test.describe('the component detail page', () => {
  test('a flipper switch names the connector it is wired to', async ({ page }) => {
    await gotoHydrated(page, '/switch/F2');
    await expect(page.locator('.detail .kind')).toContainText('Flipper (J805)');
    await gotoHydrated(page, '/switch/F1');
    await expect(page.locator('.detail .kind')).toContainText('Flipper (J806)');
  });

  test('a part the map does not draw says where it is, not Show on map (DA2-06)', async ({
    page,
  }) => {
    await gotoHydrated(page, '/switch/F1');
    await expect(page.getByRole('button', { name: 'Show on map' })).toHaveCount(0);
    await expect(page.locator('.detail')).toContainText(
      'Not on the playfield map: on the flipper assembly under the playfield.',
    );
  });

  test('carries the spec anatomy and keeps its contracts', async ({ page }) => {
    await gotoHydrated(page, '/switch/32');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Switch 32');
    const d = page.locator('.detail');
    await expect(d.locator('.code.lg')).toHaveText('32');
    await expect(d.locator('h2').first()).toHaveText('Upper Right Jet');
    await expect(d.locator('.kind')).toContainText('Matrix column 3, row 2');
    await expect(d.locator('.kind')).toContainText('Not tested');
    // Exactly one visible button containing "Fault" and one named "OK".
    await expect(page.getByRole('button', { name: /Fault/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'OK', exact: true })).toHaveCount(1);
    await expect(page.getByLabel('Note')).toBeVisible();
    for (const h of ['Wiring', 'Parts', 'Location', 'Related', 'Service log'])
      await expect(page.getByRole('heading', { level: 3, name: h })).toBeVisible();
    await expect(d).toContainText('SW-11A-37');
    await expect(d).toContainText('B-12030-2');
    await expect(page.getByRole('link', { name: /^Callout 32 on p\. 2-/ })).toBeVisible();
    // The same name comes first, then the same assembly.
    const related = page.getByRole('heading', { level: 3, name: 'Related' }).locator('+ ul a.lrow');
    await expect(related.first()).toHaveAttribute('href', /lamp\/22$/);
    await expect(page.getByRole('link', { name: /Upper Right Jet.*Lamp/ })).toHaveAttribute(
      'href',
      /lamp\/22$/,
    );
    await expect(page.getByRole('link', { name: /Upper Right Jet.*Solenoid/ })).toHaveAttribute(
      'href',
      /coil\/10$/,
    );
    // A related lamp names its bulb in place of its matrix place, on one line (spec §9.7).
    const lampSub = page.getByRole('link', { name: /Upper Right Jet.*Lamp/ }).locator('.sub');
    await expect(lampSub).toHaveText('Lamp · bulb #555');
    expect((await lampSub.boundingBox())!.height).toBeLessThanOrEqual(22);
    await expect(page.getByText('Everything you record stays on this device.')).toBeVisible();
    await expect(page.locator('.notes')).toContainText('Appendices');
    await expect(page.locator('.notes').getByRole('link').first()).toHaveAttribute(
      'href',
      /handbook\/appendix#/,
    );
  });

  test('the status control shows the state, logs it and clears on a second press', async ({
    page,
  }) => {
    await gotoHydrated(page, '/switch/32');
    await page.getByRole('button', { name: 'Fault' }).click();
    await expect(page.locator('.detail .kind .cur')).toHaveText('Fault');
    await expect(page.getByLabel('Service log').locator('li')).toHaveCount(1);
    await expect(page.getByLabel('Service log')).toContainText('Fault');
    await page.getByRole('button', { name: 'Fault' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Fault' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.locator('.detail .kind .cur')).toHaveText('Not tested');
  });

  test('"Add to list" marks Fault and turns into a link to the list', async ({ page }) => {
    await gotoHydrated(page, '/switch/32');
    await page.getByRole('button', { name: 'Add to list' }).click();
    await expect(page.getByRole('button', { name: 'Fault' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('link', { name: 'On the list' })).toHaveAttribute(
      'href',
      /shopping$/,
    );
    await expect(page.getByRole('button', { name: 'Add to list' })).toHaveCount(0);
  });

  test('Show on map opens a modal sheet; Esc returns focus to its button', async ({
    page,
    browserName,
  }) => {
    await gotoHydrated(page, '/switch/32');
    const open = page.getByRole('button', { name: 'Show on map' });
    await activate(open, browserName);
    const dialog = page.getByRole('dialog', { name: 'Switch 32, Upper Right Jet' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Show on map' })).toHaveAttribute(
      'href',
      /map\?layer=sw&id=32$/,
    );
    await expect(dialog.getByRole('link', { name: /^Manual p\. 2-/ })).toHaveAttribute(
      'href',
      /manual\/ops\/\d+\?mark=32$/,
    );
    await expect(dialog).toContainText(/Callout 32 on p\. 2-/);
    await expect(dialog.locator('.mini .ring')).toBeVisible();
    // The parent is inert while the sheet is open.
    await expect(page.locator('.detail')).toHaveAttribute('inert', '');
    await expect(page.locator('header.top')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(open).toBeFocused();
    await expect(page.locator('.detail')).not.toHaveAttribute('inert', '');
  });
});

test('visiting a component puts it first under Recently viewed on /tables', async ({ page }) => {
  await gotoHydrated(page, '/tables');
  await expect(page.locator('[data-recent]')).toBeHidden();
  await gotoHydrated(page, '/switch/32');
  await gotoHydrated(page, '/tables');
  const rows = page.locator('[data-recent] .lrow');
  await expect(page.locator('[data-recent]')).toBeVisible();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('32');
  await expect(rows.first()).toContainText('Upper Right Jet');
  await expect(rows.first()).toContainText('Switch · matrix column 3, row 2');
  await expect(rows.first()).toHaveAttribute('href', /switch\/32$/);
  await gotoHydrated(page, '/lamp/13');
  await gotoHydrated(page, '/switch/32');
  await gotoHydrated(page, '/tables');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('32');
  await expect(rows.nth(1)).toContainText('L13');
  // The search filter includes the group.
  await page.getByRole('searchbox', { name: 'Search tables' }).fill('jackpot');
  await expect(page.locator('[data-recent] .lrow:visible')).toHaveCount(1);
  await expect(page.locator('[data-recent] .lrow:visible')).toContainText('L13');
});

test('a filter no hub matches links to the search of everything (AR3-08)', async ({ page }) => {
  await gotoHydrated(page, '/tables');
  await page.getByRole('searchbox', { name: 'Search tables' }).fill('32');
  await expect(page.locator('[data-group]:visible')).toHaveCount(0);
  await expect(page.locator('[data-empty]')).toContainText('No tables match “32”.');
  const all = page.getByRole('link', { name: 'Search everything for “32”' });
  await expect(all).toHaveAttribute('href', /\/\?q=32$/);
  await all.click();
  await expect(page).toHaveURL(/\?q=32$/);
  await expect(page.locator('.rh')).toContainText('1 code');
});

/* P3 item 1 of the app audit (spec §13): one state word and one verb per destination. */
test.describe('one name per thing', () => {
  for (const [path, name] of [
    ['/switches', 'Left Flipper Button'],
    ['/lamps', 'Thing Multiball'],
    ['/coils', 'Chair Kickout'],
  ] as const) {
    test(`${path}: the tick column is Fault`, async ({ page }) => {
      await gotoHydrated(page, path);
      await expect(page.locator('main table th', { hasText: /^Fault$/ }).first()).toBeAttached();
      await expect(page.locator('main table th', { hasText: /Broken/ })).toHaveCount(0);
      await expect(page.getByLabel(`Fault: ${name}`, { exact: true })).toHaveCount(1);
    });
  }

  test('Details, Show on map and Manual p. n are the only verbs', async ({ page }) => {
    await gotoHydrated(page, '/switches');
    await page.locator('[data-cell="32"]').focus();
    const card = page.locator('[data-cell-card="32"]');
    await expect(card.getByRole('link', { name: 'Details', exact: true })).toHaveCount(1);
    await expect(card.getByRole('link', { name: 'Show on map', exact: true })).toHaveCount(1);
    await expect(card.getByRole('link', { name: /^Open/ })).toHaveCount(0);

    await gotoHydrated(page, '/switch/32');
    await page.getByRole('button', { name: 'Show on map' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('link', { name: 'Show on map', exact: true })).toHaveCount(1);
    await expect(sheet.getByRole('link', { name: /^Manual p\. 2-\d+$/ })).toHaveCount(1);
    await expect(sheet.getByRole('link', { name: /^Open|^Manual page$/ })).toHaveCount(0);
  });

  test('the grid and the map sheet carry the page and component names (CP2-12, CP2-18)', async ({
    page,
  }) => {
    await gotoHydrated(page, '/switches');
    await expect(page.getByRole('grid', { name: 'Switch matrix', exact: true })).toBeAttached();
    // The arrow-key hint shows only where there are arrow keys: not on a touch phone.
    const touch = await page.evaluate(() => matchMedia('(hover: none), (pointer: coarse)').matches);
    expect(touch).toBe(!!test.info().project.use.isMobile);
    const hint = page.getByText('Use the arrow keys to move between cells.');
    await (touch ? expect(hint).toBeHidden() : expect(hint).toBeVisible());

    await gotoHydrated(page, '/switch/32');
    await expect(page).toHaveTitle('Switch 32, Upper Right Jet · The Addams Family Handbook');
  });
});
