import { expect, type Page } from '@playwright/test';

/**
 * Navigates and waits until every Astro island has hydrated. Island markup is server-rendered, so
 * a click that lands before hydration hits a button with no handler yet; Astro drops the `ssr`
 * attribute from `<astro-island>` once the component is live. Only `client:load` islands count;
 * `client:visible` ones stay unhydrated off-screen.
 */
export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('astro-island[ssr][client="load"]')).toHaveCount(0);
}
