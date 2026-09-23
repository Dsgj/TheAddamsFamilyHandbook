import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('setup guide records values and ticks on the device', async ({ page }) => {
  await gotoHydrated(page, '/setup');
  await expect(page.getByRole('status')).toContainText('0 /');

  const item = page.locator('.item', { hasText: 'Tournament Play' });
  await item.getByRole('button', { name: 'YES' }).click();
  await expect(item.getByRole('textbox')).toHaveValue('YES');
  await item.getByLabel('Done: Tournament Play').check();
  await expect(page.getByRole('status')).toContainText('1 /');
  await expect(item).toHaveClass(/done/);
  await expect(item.getByRole('link', { name: 'handbook' })).toHaveAttribute(
    'href',
    /handbook\/adjustments#p\d+-\d+/,
  );

  const task = page.locator('.item', { hasText: 'remove the glass' });
  await expect(task.getByRole('textbox')).toHaveCount(0);
  await task.getByRole('checkbox').check();
  await expect(page.getByRole('status')).toContainText('2 /');

  await page.reload();
  await expect(page.getByRole('status')).toContainText('2 /');
  await expect(
    page.locator('.item', { hasText: 'Tournament Play' }).getByRole('textbox'),
  ).toHaveValue('YES');
});

test('setup values travel in the backup file', async ({ page }) => {
  await gotoHydrated(page, '/setup');
  const item = page.locator('.item', { hasText: 'Custom Message' }).first();
  await item.getByRole('textbox').fill('EDUCATION FIRST / PINBALL SECOND');
  await item.getByRole('textbox').press('Tab');

  await gotoHydrated(page, '/shopping');
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

  await page.getByLabel('Import mode').selectOption('replace');
  await page.getByLabel('Read backup file').setInputFiles({
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
  await expect(page.getByRole('status')).toContainText('0 components and 2 settings read');
  await gotoHydrated(page, '/setup');
  await expect(page.getByRole('status')).toContainText('2 /');
  await expect(
    page.locator('.item', { hasText: 'Custom Message' }).first().getByRole('textbox'),
  ).toHaveValue('');
});
