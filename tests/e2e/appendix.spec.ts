import { expect, test } from '@playwright/test';
import { gotoHydrated } from './helpers';

test('component pages link to the owner appendices and the handbook shows them last', async ({
  page,
}) => {
  await gotoHydrated(page, '/coil/01');
  const notes = page.locator('.notes');
  await expect(notes).toContainText('Service notes');
  const first = notes.getByRole('link').first();
  await expect(first).toHaveText(/A2 Coils/);
  await expect(first).toHaveAttribute('href', /handbook\/appendix#p10\d-\d+/);

  await first.click();
  await expect(page).toHaveURL(/handbook\/appendix#p10\d-\d+/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Appendix/);
  await expect(page.locator('.prov.warn')).toContainText("owner's own notes");
  await expect(page.locator('.pg-bar').first()).toContainText('Appendix A1');
  await expect(page.locator('.pg-bar a', { hasText: 'Scan' })).toHaveCount(0);

  await gotoHydrated(page, '/switch/21');
  await expect(page.locator('.notes').getByRole('link').first()).toHaveText(/A3 Switches/);
});
