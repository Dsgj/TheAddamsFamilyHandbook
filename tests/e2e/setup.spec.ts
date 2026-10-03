import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('setup guide records values and ticks on the device', async ({ page }) => {
  await gotoHydrated(page, '/setup');
  await expect(page.getByRole('status')).toContainText('0 of 47');

  const item = page.locator('.item', { hasText: 'Tournament Play' });
  await item.getByRole('button', { name: 'YES' }).click();
  await expect(item.getByRole('textbox')).toHaveValue('YES');
  // The tick's name carries the menu code (audit AY-10): two items share a name elsewhere.
  await item.getByLabel('Done: A.1 26 Tournament Play').check();
  await expect(page.getByRole('status')).toContainText('1 of 47');
  await expect(item).toHaveClass(/done/);
  await expect(item.getByRole('link', { name: 'handbook' })).toHaveAttribute(
    'href',
    /handbook\/adjustments#p\d+-\d+/,
  );

  const task = page.locator('.item', { hasText: 'remove the glass' });
  await expect(task.getByRole('textbox')).toHaveCount(0);
  await task.getByRole('checkbox').check();
  await expect(page.getByRole('status')).toContainText('2 of 47');

  await page.reload();
  await expect(page.getByRole('status')).toContainText('2 of 47');
  await expect(
    page.locator('.item', { hasText: 'Tournament Play' }).getByRole('textbox'),
  ).toHaveValue('YES');
});

test('setup values travel in the backup file', async ({ page }) => {
  await gotoHydrated(page, '/setup');
  const item = page.locator('.item', { hasText: 'Custom Message' }).first();
  await item.getByRole('textbox').fill('EDUCATION FIRST / PINBALL SECOND');
  await item.getByRole('textbox').press('Tab');

  await gotoHydrated(page, '/shopping', ['DeviceData']);
  await expect(page.locator('.device')).toContainText('1 setting recorded');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download backup' }).click(),
  ]);
  const file = JSON.parse(readFileSync(await download.path(), 'utf8')) as {
    setup: Record<string, { value: string }>;
  };
  expect(Object.values(file.setup).map((s) => s.value)).toContain(
    'EDUCATION FIRST / PINBALL SECOND',
  );

  await page.getByLabel('When restoring').selectOption('replace');
  await page.getByLabel('Restore from backup').setInputFiles({
    name: 'setup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        app: 'tafh',
        version: 1,
        exportedAt: '2026-09-23T00:00:00Z',
        items: {},
        setup: {
          'A.1 01': { value: '3', done: true, at: '2026-09-23T00:00:00Z' },
          'A.1 02': { value: '3', done: true, at: '2026-09-23T00:00:00Z' },
        },
      }),
    ),
  });
  // The file drops the custom message typed above, so replace asks once more before writing.
  await page.getByRole('button', { name: /^Really replace\? 1 entry here will be lost/ }).click();
  await expect(page.getByRole('status')).toContainText('0 components and 2 settings restored');
  await gotoHydrated(page, '/setup');
  await expect(page.getByRole('status')).toContainText('2 of 47');
  await expect(
    page.locator('.item', { hasText: 'Custom Message' }).first().getByRole('textbox'),
  ).toHaveValue('');
});
