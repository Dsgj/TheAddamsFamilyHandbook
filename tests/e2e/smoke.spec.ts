import { expect, test } from '@playwright/test';

test('diagnose resolves a test-report line', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Test report or display message').fill('32 68 F1 F3');
  await expect(page.locator('article.comp')).toHaveCount(4);
  await expect(page.getByText('Shared cause?')).toBeVisible();
  await expect(page.getByText(/J806/).first()).toBeVisible();
  await expect(page.locator('article.comp[data-id="32"] h2')).toContainText('Upper Right Jet');
});

test('map marker opens the component card', async ({ page }) => {
  await page.goto('/map?layer=sw');
  await page
    .getByRole('button', { name: /^32 Upper Right Jet/ })
    .first()
    .click();
  await expect(page.locator('aside article.comp[data-id="32"]')).toBeVisible();
  await expect(page).toHaveURL(/id=32/);
});

test('switch matrix supports keyboard navigation', async ({ page }) => {
  await page.goto('/switches');
  const first = page.locator('[data-cell="11"]');
  await first.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-cell="21"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-cell="22"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/switch\/22$/);
});

test('handbook menu map links resolve', async ({ page }) => {
  await page.goto('/handbook/menus');
  const link = page.locator('.mmap a[href*="#"]').first();
  await expect(link).toHaveAttribute(
    'href',
    /handbook\/(menus|tests|utilities|adjustments|presets)#p\d+-\d+/,
  );
  await link.click();
  await expect(page).toHaveURL(/#p\d+-\d+/);
});

test('manual viewer navigates and shows OCR text', async ({ page }) => {
  await page.goto('/manual/ops/25');
  await expect(page.locator('.stage img').first()).toBeVisible();
  await page.getByRole('button', { name: 'Text' }).click();
  await expect(page.locator('.text pre')).toContainText('Test Menu');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/manual\/ops\/26$/);
});

test('parts search finds a flipper coil', async ({ page }) => {
  await page.goto('/parts');
  await page.getByLabel('Search parts').fill('FL-11753');
  await expect(page.locator('tbody tr').first()).toContainText('FL-11753');
});

test('status persists on the device', async ({ page }) => {
  await page.goto('/switch/32');
  await page.getByRole('button', { name: 'Fault' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Fault' })).toHaveAttribute('aria-pressed', 'true');
});

test('theme toggle switches to the other palette', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(after).not.toBe(before);
});
