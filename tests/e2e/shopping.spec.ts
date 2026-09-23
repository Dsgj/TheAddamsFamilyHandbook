import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('Broken tick on Lamps feeds the shopping list until Fixed', async ({ page }) => {
  await gotoHydrated(page, '/lamps');
  const tick = page.getByLabel('Broken: Thing Multiball');
  await expect(tick).not.toBeChecked();
  await tick.check();
  // The matrix island on the same page recolours live.
  await expect(page.locator('table.matrix td.st-fault [data-cell="11"]')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Broken: Thing Multiball')).toBeChecked();

  await gotoHydrated(page, '/shopping');
  await expect(page.getByRole('heading', { name: 'Lamps' })).toBeVisible();
  await expect(page.getByText('1 ×')).toBeVisible();
  await expect(page.getByText('#555')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy as text' })).toBeVisible();
  await page.getByRole('button', { name: 'Show text' }).click();
  await expect(page.locator('textarea')).toHaveValue(
    'Lamps\n1 × #555 (24-8768): L11 Thing Multiball',
  );

  await page.getByRole('button', { name: 'Fixed: Thing Multiball' }).click();
  await expect(page.getByText('Nothing marked Fault yet')).toBeVisible();
});

test('Broken tick on Switches and Solenoids lands on the shopping list', async ({ page }) => {
  await gotoHydrated(page, '/switches');
  await page.getByLabel('Broken: Left Flipper Button').check();
  await gotoHydrated(page, '/coils');
  await page.getByLabel('Broken: Chair Kickout').check();
  await gotoHydrated(page, '/shopping');
  await expect(page.getByRole('heading', { name: 'Switches' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Solenoids' })).toBeVisible();
  await expect(page.getByRole('link', { name: /C01 Chair Kickout/ })).toHaveAttribute(
    'href',
    /coil\/01$/,
  );
});
