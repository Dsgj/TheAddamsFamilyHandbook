import { expect, test } from '@playwright/test';
import { gotoHydrated, swReady } from './helpers';

const status = { id: 'switch:32', status: 'fault', note: 'original', at: '2026-10-25T10:00:00Z' };
const backup = JSON.stringify({
  app: 'tafh',
  version: 2,
  items: { 'switch:32': { ...status, status: 'ok', note: 'restored', at: '2026-10-26T10:00:00Z' } },
  setup: { 'A.1 01': { value: '5', done: true, at: '2026-10-26T10:00:00Z' } },
  verify: {},
});
const upload = { name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from(backup) };

test('history alone remains downloadable and clearable', async ({ page }) => {
  await page.goto('/shopping');
  await page.evaluate((entry) => {
    localStorage.clear();
    localStorage.setItem(
      'tafh:status',
      JSON.stringify({
        'switch:32': {
          ...entry,
          status: '',
          note: '',
          history: [
            { status: 'fault', at: entry.at },
            { status: '', at: '2026-10-26T10:00:00Z' },
          ],
        },
      }),
    );
  }, status);
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await expect(page.locator('.device')).toContainText('1 component recorded');
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);
  expect(file.suggestedFilename()).toMatch(/tafh-status/);
  await expect(page.getByRole('button', { name: 'Clear all', exact: true })).toBeEnabled();
});

test('a refused atomic restore keeps original data after reload', async ({ page }) => {
  await page.goto('/shopping');
  await page.evaluate(
    (entry) => localStorage.setItem('tafh:status', JSON.stringify({ 'switch:32': entry })),
    status,
  );
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await page.evaluate(() => {
    const put = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tafh:snapshot') throw new DOMException('full', 'QuotaExceededError');
      put.call(this, key, value);
    };
  });
  await page.getByLabel('Restore from backup').setInputFiles(upload);
  await expect(page.locator('.device [role=status]')).toContainText('would not save');
  await gotoHydrated(page, '/switch/32');
  await expect(page.getByRole('textbox', { name: 'Note' })).toHaveValue('original');
  await gotoHydrated(page, '/setup');
  await expect(page.getByRole('status')).toContainText('0 of 47');
});

test('all restored sections survive a refused legacy mirror and subsequent editing', async ({
  page,
}) => {
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await page.evaluate(() => {
    const put = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'tafh:setup') throw new DOMException('full', 'QuotaExceededError');
      put.call(this, key, value);
    };
  });
  await page.getByLabel('Restore from backup').setInputFiles(upload);
  await expect(page.locator('.device [role=status]')).toContainText('restored from');
  await gotoHydrated(page, '/setup');
  const item = page.locator('.item', { hasText: 'Balls Per Game' });
  await expect(item.getByRole('textbox')).toHaveValue('5');
  await item.getByRole('textbox').fill('3');
  await item.getByRole('textbox').blur();
  await page.reload();
  await expect(item.getByRole('textbox')).toHaveValue('3');
  await gotoHydrated(page, '/switch/32');
  await expect(page.getByRole('textbox', { name: 'Note' })).toHaveValue('restored');
});

test('a restored snapshot synchronizes another open tab and keeps its subsequent edits', async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await gotoHydrated(other, '/switch/32');
  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await page.getByLabel('Restore from backup').setInputFiles(upload);
  await expect(other.getByRole('textbox', { name: 'Note' })).toHaveValue('restored');
  await other.getByRole('textbox', { name: 'Note' }).fill('updated in second tab');
  await other.getByRole('textbox', { name: 'Note' }).blur();
  await gotoHydrated(page, '/switch/32');
  await expect(page.getByRole('textbox', { name: 'Note' })).toHaveValue('updated in second tab');
});

test('setup continues to unfinished work and completed steps can be reopened', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await gotoHydrated(page, '/setup');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.guide-help')).toContainText('does not change machine settings');
  const first = page.locator('#step-presets');
  await expect(first.getByRole('textbox')).toHaveCount(0);
  for (const checkbox of await first.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Hide completed steps' }).click();
  await expect(first).toBeHidden();
  await page.getByRole('button', { name: 'Continue with next unfinished setting' }).click();
  await expect(page.locator('#step-freeplay input[type=checkbox]')).toBeFocused();
  await page.getByRole('button', { name: 'Show all steps' }).click();
  await expect(first).toBeVisible();
});

test('a repeated care task gets a fresh completion date with one action', async ({ page }) => {
  await page.goto('/care');
  await page.evaluate(() =>
    localStorage.setItem(
      'tafh:setup',
      JSON.stringify({ 'care-balls': { value: '', done: true, at: '2020-01-01T12:00:00Z' } }),
    ),
  );
  await gotoHydrated(page, '/care');
  const item = page.locator('.item', { hasText: 'Wipe the balls' });
  await expect(item.getByRole('checkbox')).toBeChecked();
  await item.getByRole('button', { name: /^Done today:/ }).click();
  await expect(item.getByRole('button', { name: /^Done today:/ })).toBeDisabled();
  await expect(item.locator('.when')).not.toContainText('2020');
});

test('mobile map exposes layer names without an onboarding barrier', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoHydrated(page, '/map');
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await expect(page.locator('.layers.named')).toBeVisible();
  await expect(page.locator('.layer-name')).toHaveCount(4);
  await expect(page.locator('.layer-help')).toContainText('Tap a marker');
});

test('a previous build’s completion flag does not suppress offline downloads', async ({ page }) => {
  await page.goto('/workshop');
  await swReady(page);
  await page.evaluate(async () => {
    sessionStorage.setItem('tafh:warm', 'previous-build');
    for (const name of await caches.keys())
      if (name.startsWith('tafh-pages-')) await caches.delete(name);
    await caches.open('tafh-pages-other-open-tab');
  });
  await gotoHydrated(page, '/workshop');
  await page.waitForFunction(() => document.documentElement.dataset.warm === 'done', null, {
    timeout: 30_000,
  });
  await expect(page.locator('.hub-body')).toContainText('Handbook and component pages saved');
  expect(await page.evaluate(() => sessionStorage.getItem('tafh:warm'))).not.toBe('previous-build');
  expect(await page.evaluate(() => caches.has('tafh-pages-other-open-tab'))).toBe(true);
});
