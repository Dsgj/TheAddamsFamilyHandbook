import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('diagnose flags two lamps in one column as a driver problem', async ({ page }) => {
  await gotoHydrated(page, '/');
  await page.getByLabel('Test report or display message').fill('L11 L12');
  const causes = page.locator('.causes');
  await expect(causes).toContainText('share lamp column 1');
  await expect(causes).toContainText('Q98');
  await expect(causes.getByRole('link', { name: 'matrix' })).toHaveAttribute('href', /lamps/);
});

test('diagnose accepts a pasted multi-line test report', async ({ page }) => {
  await gotoHydrated(page, '/');
  await page
    .getByLabel('Test report or display message')
    .fill('TEST REPORT\nT.1 SWITCH EDGES\nSWITCH 32 UPPER RIGHT JET\nSWITCH 68 VAULT\nLAMP 55');
  await expect(page.locator('.cards article')).toHaveCount(3);
  await expect(page.locator('.prov', { hasText: 'Not recognised' })).toHaveCount(0);
});

test('a bare digit is not a solenoid', async ({ page }) => {
  await gotoHydrated(page, '/');
  await page.getByLabel('Test report or display message').fill('row 5');
  await expect(page.locator('.cards article')).toHaveCount(0);
  await expect(page.locator('.prov')).toContainText('Not recognised');
});

test('component card keeps a service log of status changes', async ({ page }) => {
  await gotoHydrated(page, '/switch/32');
  await page.getByRole('button', { name: 'Fault' }).click();
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  const log = page.getByLabel('Service log');
  await expect(log.locator('li')).toHaveCount(2);
  await expect(log.locator('li').first()).toContainText('OK');
  await expect(log.locator('li').last()).toContainText('Fault');
  await page.reload();
  await expect(page.getByLabel('Service log').locator('li')).toHaveCount(2);
});

test('lamp and solenoid cards carry the status row', async ({ page }) => {
  await gotoHydrated(page, '/lamp/11');
  await expect(page.getByRole('button', { name: 'Fault' })).toBeVisible();
  await gotoHydrated(page, '/coil/07');
  await expect(page.getByRole('button', { name: 'Fault' })).toBeVisible();
});

test('device data downloads a backup and reads one back', async ({ page }) => {
  await gotoHydrated(page, '/switch/32');
  await page.getByRole('button', { name: 'Fault' }).click();
  await gotoHydrated(page, '/shopping');
  await expect(page.locator('.device')).toContainText('1 component recorded');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^tafh-status-\d{4}-\d{2}-\d{2}\.json$/);

  const backup = JSON.stringify({
    app: 'tafh',
    version: 1,
    exportedAt: '2026-09-23T00:00:00Z',
    items: {
      'lamp:11': { id: 'lamp:11', status: 'fault', note: '', at: '2026-09-23T00:00:00Z' },
      'coil:07': { id: 'coil:07', status: 'fault', note: '', at: '2026-09-23T00:00:00Z' },
    },
  });
  await page.getByLabel('Import mode').selectOption('replace');
  await page.getByLabel('Read backup file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backup),
  });
  await expect(page.getByRole('status')).toContainText('2 components read');
  await expect(page.locator('.device')).toContainText('2 components recorded');
  await expect(page.locator('.grp', { hasText: 'Lamps' })).toContainText('Thing Multiball');
  await expect(page.locator('.grp', { hasText: 'Switches' })).toHaveCount(0);
});

test('device data needs two taps to clear everything', async ({ page }) => {
  await gotoHydrated(page, '/switch/32');
  await page.getByRole('button', { name: 'Fault' }).click();
  await gotoHydrated(page, '/shopping');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.locator('.device')).toContainText('1 component recorded');
  await page.getByRole('button', { name: 'Really clear all?' }).click();
  await expect(page.locator('.device')).not.toContainText('recorded');
});

test('verify checklist ticks persist on the device', async ({ page }) => {
  await gotoHydrated(page, '/verify');
  const box = page.locator('input.verify-check[data-id="flasher-count"]');
  await box.check();
  await expect(page.locator('[data-verify-count]')).toContainText('1 of');
  await expect(box.locator('xpath=ancestor::li')).toContainText('verified 20');
  await page.reload();
  await expect(page.locator('input.verify-check[data-id="flasher-count"]')).toBeChecked();
  await expect(page.locator('[data-verify-count]')).toContainText('1 of');
});
