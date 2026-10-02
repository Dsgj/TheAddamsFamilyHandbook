import { expect, type Locator, type Page } from '@playwright/test';

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

/**
 * Opens a sheet's button the way the browser can hand focus back to it: a click in Chromium, Enter
 * in WebKit, where a tapped button takes no focus (Safari's model), so there would be no opener to
 * return to (known, not changed).
 */
export function activate(button: Locator, browserName: string) {
  return browserName === 'webkit' ? button.press('Enter') : button.click();
}

/** Two animation frames: what the last input queued for the next frame has run (no fake clock
 *  paused, or this never resolves). */
export function twoFrames(page: Page) {
  return page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );
}

/**
 * Counts the navigations the page starts from now on: the Navigation API's `navigate` event fires
 * as `history.back()` or `location.replace()` is called, before anything loads (Chromium).
 */
export async function countNavigations(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { navs: number; navigation: EventTarget };
    w.navs = 0;
    w.navigation.addEventListener('navigate', () => w.navs++);
  });
  return () => page.evaluate(() => (window as unknown as { navs?: number }).navs ?? -1);
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
