import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('care ticks keep their date and share the battery tick with setup', async ({ page }) => {
  await gotoHydrated(page, '/care');
  await expect(page.getByRole('status')).toContainText('0 /');
  await expect(page.getByRole('status')).toContainText('tasks done');

  const balls = page.locator('.item', { hasText: 'Wipe the balls' });
  await expect(balls.getByRole('textbox')).toHaveCount(0);
  await balls.getByRole('checkbox').check();
  await expect(balls).toContainText('done');
  await expect(page.getByRole('status')).toContainText('1 /');

  await page.locator('.item', { hasText: 'no batteries fitted' }).getByRole('checkbox').check();
  await expect(page.getByRole('status')).toContainText('2 /');

  await page.reload();
  await expect(page.getByRole('status')).toContainText('2 /');

  await gotoHydrated(page, '/setup');
  await expect(
    page.locator('.item', { hasText: 'no batteries fitted' }).getByRole('checkbox'),
  ).toBeChecked();

  await gotoHydrated(page, '/care');
  await expect(
    page.locator('.item', { hasText: 'T.1 Switch Edges' }).getByRole('link', { name: 'handbook' }),
  ).toHaveAttribute('href', /handbook\/tests#p\d+-\d+/);
});
