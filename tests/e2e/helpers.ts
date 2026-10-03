import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Navigates and waits until every Astro island that hydrates on its own is live, and the
 * `client:visible` ones named in `visible` (component file names) too. Island markup is
 * server-rendered, so a click that lands before hydration hits a button with no handler yet.
 */
export async function gotoHydrated(page: Page, url: string, visible: string[] = []) {
  await page.goto(url);
  await hydrated(page);
  for (const c of visible) await hydrateVisible(page, c);
}

/**
 * Every `client:load` and `client:idle` island hydrated, and every `client:media` one whose query
 * matches: Astro drops the `ssr` attribute from `<astro-island>` once the component is live.
 * `client:visible` ones stay server-rendered off screen (see hydrateVisible).
 */
export async function hydrated(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !document.querySelector('astro-island[ssr]:is([client="load"], [client="idle"])') &&
          [...document.querySelectorAll('astro-island[ssr][client="media"]')].every(
            (el) =>
              !matchMedia(JSON.parse(el.getAttribute('opts') ?? '{}').value ?? 'not all').matches,
          ),
      ),
    )
    .toBe(true);
}

/**
 * Scrolls a `client:visible` island on screen and waits until it is live. The island itself is
 * `display: contents` (no box, so it cannot scroll into view): its first child with one does.
 */
export async function hydrateVisible(page: Page, component: string) {
  const island = page.locator(`astro-island[component-url*="/${component}."]`);
  await island.evaluate((el) =>
    ([...el.children].find((c) => c.getClientRects().length) ?? el).scrollIntoView({
      block: 'center',
    }),
  );
  await expect(island).not.toHaveAttribute('ssr');
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
 * The top bar's visible links and buttons whose centre something else paints over. The bar stays
 * above whatever scrolls or rises beneath it, so this is empty (AY2-01, CR2-02).
 */
export function barCovered(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector('header.top')!;
    return [...bar.querySelectorAll<HTMLElement>('a, button')]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        if (!b.checkVisibility() || r.width < 1 || r.top < 0 || r.bottom > innerHeight)
          return false;
        const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !at || !bar.contains(at);
      })
      .map((b) => b.getAttribute('aria-label') || b.textContent!.trim());
  });
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
