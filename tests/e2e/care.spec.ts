import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('care ticks keep their date and share the battery tick with setup', async ({ page }) => {
  await gotoHydrated(page, '/care');
  await expect(page.getByRole('status')).toContainText('0 of 23');
  await expect(page.getByRole('status')).toContainText('tasks done');
  // The intro and the counter share one noun (CP3-12).
  await expect(page.locator('.intro')).toContainText('Tick a task');
  // The step numbers are body-face tabular numerals, not the heading's display face, whose lone 1
  // read as a small-caps I (audit P2 item 10, VP3-04).
  const badge = page.locator('.step h2 .n').first();
  await expect(badge).toHaveText('1');
  expect(await badge.evaluate((n) => getComputedStyle(n).fontFamily)).not.toMatch(/Fell/);

  const balls = page.locator('.item', { hasText: 'Wipe the balls' });
  await expect(balls.getByRole('textbox')).toHaveCount(0);
  await balls.getByRole('checkbox').check();
  await expect(balls).toContainText('done');
  await expect(page.getByRole('status')).toContainText('1 of 23');

  await page.locator('.item', { hasText: 'no batteries fitted' }).getByRole('checkbox').check();
  await expect(page.getByRole('status')).toContainText('2 of 23');

  await page.reload();
  await expect(page.getByRole('status')).toContainText('2 of 23');

  await gotoHydrated(page, '/setup');
  await expect(
    page.locator('.item', { hasText: 'no batteries fitted' }).getByRole('checkbox'),
  ).toBeChecked();

  await gotoHydrated(page, '/care');
  await expect(
    page.locator('.item', { hasText: 'T.1 Switch Edges' }).getByRole('link', { name: 'handbook' }),
  ).toHaveAttribute('href', /handbook\/tests#p\d+-\d+/);
});
