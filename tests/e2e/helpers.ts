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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The app's date format (spec §13), "21 Sep 2026", for a moment as a Stockholm clock shows it:
 * for tests that run with `timezoneId: 'Europe/Stockholm'`. The month comes from a numeric part
 * through a fixed list, never from ICU, whose en-GB short September is "Sept".
 */
export function dayLabel(at: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Stockholm',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date(at));
  const part = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return `${part('day')} ${MONTHS[part('month') - 1]} ${part('year')}`;
}
