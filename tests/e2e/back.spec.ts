import { expect, test, type Page } from '@playwright/test';
import {
  countNavigations,
  gotoHydrated,
  hydrated,
  motion,
  settle,
  swReady,
  pageErrors,
  touchDrag,
  transition,
} from './helpers';

/* Audit P1 item 7, back behaviour. The header back link and swipe back step back through history
   when the previous entry is where they lead, and otherwise replace the page they leave; each
   entry keeps the back link it was given; Diagnose writes `?q=` once results are committed; the
   Map writes a kind-qualified id; manual paging replaces. Every step checks the address,
   history.length and the Navigation API index, since the address alone looks the same whether a
   back pushed or traversed. Paths are relative, so this also runs under a BASE_PATH. */

interface Where {
  url: string;
  len: number;
  idx: number;
}
interface NavLike {
  currentEntry: { index: number } | null;
}

/** The address without the base, history.length, and the entry's index in this app's run. */
const where = (page: Page): Promise<Where> =>
  page.evaluate(() => {
    const w = window as unknown as { __nav?: NavLike; navigation?: NavLike };
    const nav = w.__nav ?? w.navigation;
    const base = document.querySelector('a.shell-logo')?.getAttribute('href') ?? '/';
    return {
      url: '/' + location.pathname.slice(base.length) + location.search,
      len: history.length,
      idx: nav?.currentEntry?.index ?? -1,
    };
  });

const backLink = (page: Page) => page.locator('header.top a.back');
const field = (page: Page) => page.getByLabel('Test report or display message');
const diag = (page: Page) => page.locator('section.diag');
const card = (page: Page) => page.locator('article.comp h3 a').first();
const tabLink = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Sections' }).locator('a.tab', { hasText: name });
const CARD = /\/(switch|lamp|coil)\/[^/?]+$/;

test.describe('the header back link', { tag: '@subpath' }, () => {
  test('steps back through history, so Forward still leads on (UX-02)', async ({ page }) => {
    await gotoHydrated(page, 'switches');
    const s = await where(page);
    await page.locator('main a[data-cell="32"]').first().click();
    await settle(page, /\/switch\/32$/);
    expect(await where(page)).toEqual({ url: '/switch/32', len: s.len + 1, idx: s.idx + 1 });
    await backLink(page).click();
    await settle(page, /\/switches$/);
    expect(await where(page)).toEqual({ url: '/switches', len: s.len + 1, idx: s.idx });
    await page.goForward();
    await settle(page, /\/switch\/32$/);
    expect(await where(page)).toEqual({ url: '/switch/32', len: s.len + 1, idx: s.idx + 1 });
  });

  test('still steps back with site data blocked (CO2-11)', async ({ page }) => {
    const errors = pageErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'sessionStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await gotoHydrated(page, 'switches');
    const s = await where(page);
    await page.locator('main a[data-cell="32"]').first().click();
    await settle(page, /\/switch\/32$/);
    await expect(backLink(page)).toHaveText('Switches');
    await backLink(page).click();
    await settle(page, /\/switches$/);
    expect(await where(page)).toEqual({ url: '/switches', len: s.len + 1, idx: s.idx });
    // Nothing is kept across pages without storage, so the tab link stays on its root.
    await expect(tabLink(page, 'Tables')).toHaveAttribute('href', /\/tables$/);
    expect(errors).toEqual([]);
  });

  test('on a cold link replaces the page, up to the tab root', async ({ page }) => {
    await gotoHydrated(page, 'switch/32');
    const s = await where(page);
    await backLink(page).click();
    await settle(page, /\/switches$/);
    expect(await where(page)).toEqual({ url: '/switches', len: s.len, idx: s.idx });
    await expect(backLink(page)).toHaveText('Tables');
    await backLink(page).click();
    await settle(page, /\/tables$/);
    expect(await where(page)).toEqual({ url: '/tables', len: s.len, idx: s.idx });
  });

  test('keeps its own link after Back, instead of pointing at the page ahead', async ({ page }) => {
    await gotoHydrated(page, 'switches');
    const s = await where(page);
    await page.locator('main a[data-cell="32"]').first().click();
    await settle(page, /\/switch\/32$/);
    await gotoHydrated(page, 'map?layer=sw&id=32');
    await page.goBack();
    await settle(page, /\/switch\/32$/);
    await expect(backLink(page)).toHaveText('Switches');
    await expect(backLink(page)).toHaveAttribute('href', /\/switches$/);
    await backLink(page).click();
    await settle(page, /\/switches$/);
    expect(await where(page)).toEqual({ url: '/switches', len: s.len + 2, idx: s.idx });
  });

  test('moves one step for a double activation', async ({ page }) => {
    await gotoHydrated(page, 'switches');
    const s = await where(page);
    await page.locator('main a[data-cell="32"]').first().click();
    await settle(page, /\/switch\/32$/);
    // The second activation is ignored on the spot: one history step is taken, not two.
    const backs = await backLink(page).evaluate((a: HTMLAnchorElement) => {
      let n = 0;
      const back = history.back.bind(history);
      history.back = () => {
        n++;
        back();
      };
      a.click();
      a.click();
      return n;
    });
    expect(backs).toBe(1);
    await settle(page, /\/switches$/);
    expect(await where(page)).toEqual({ url: '/switches', len: s.len + 1, idx: s.idx });
  });

  test('says where the page came from (UX-08)', async ({ page }) => {
    await gotoHydrated(page, 'verify');
    await page.locator('main a[href*="switch/"]').first().click();
    await settle(page, /\/switch\/[^/]+$/);
    await expect(backLink(page)).toHaveText('Verify');
    await expect(backLink(page)).toHaveAttribute('href', /\/verify$/);

    await gotoHydrated(page, 'lamps');
    await page.getByLabel('Fault: Thing Multiball').check();
    await gotoHydrated(page, 'shopping');
    await page.locator('main a.lnk').first().click();
    await settle(page, /\/lamp\/11$/);
    await expect(backLink(page)).toHaveText('Shopping list');
    await expect(backLink(page)).toHaveAttribute('href', /\/shopping$/);
  });

  test('keeps the static parent after a typed URL', async ({ page }) => {
    await gotoHydrated(page, 'switches');
    await gotoHydrated(page, 'manual/ops/25');
    await expect(backLink(page)).toHaveText('Manuals');
    await expect(backLink(page)).toHaveAttribute('href', /\/manual$/);
  });

  test('from a manual page goes back to the Handbook section, past the pages turned (UX-04)', async ({
    page,
  }) => {
    await gotoHydrated(page, 'handbook/tests');
    await swReady(page);
    const s = await where(page);
    const push = await transition(
      page,
      () =>
        page
          .locator('main')
          .getByRole('link', { name: /^Manual (p\.|PDF page) / })
          .first()
          .click(),
      /\/manual\/ops\/\d+$/,
      /\/handbook\/tests$/,
    );
    expect(push.type).toBe('push');
    await expect(backLink(page)).toHaveText('Test menu');
    await expect(backLink(page)).toHaveAttribute('href', /\/handbook\/tests$/);
    const first = Number(/(\d+)$/.exec(page.url())![1]);
    expect(await where(page)).toMatchObject({ len: s.len + 1, idx: s.idx + 1 });

    await page.keyboard.press('ArrowRight');
    await settle(page, new RegExp(`/manual/ops/${first + 1}$`));
    expect(await where(page)).toMatchObject({ len: s.len + 1, idx: s.idx + 1 });
    await expect(backLink(page)).toHaveText('Test menu');

    await page.getByRole('link', { name: 'Next page' }).first().click();
    await settle(page, new RegExp(`/manual/ops/${first + 2}$`));
    expect(await where(page)).toMatchObject({ len: s.len + 1, idx: s.idx + 1 });
    await expect(backLink(page)).toHaveText('Test menu');

    await backLink(page).click();
    await settle(page, /\/handbook\/tests$/);
    expect(await where(page)).toEqual({ url: '/handbook/tests', len: s.len + 1, idx: s.idx });
  });

  test.describe('while its back is still loading', () => {
    // The service worker would answer the back from its cache; blocked, a route can hold it.
    test.use({ serviceWorkers: 'block' });

    test('a link followed instead leaves as that link, not as a back', async ({ page }) => {
      await gotoHydrated(page, 'switch/32');
      const s = await where(page);
      // The page the back replaces this one with never answers, so the back stays pending.
      await page.route(
        (u) => /\/switches$/.test(u.pathname),
        () => {},
      );
      const asked = page.waitForRequest((r) => /\/switches$/.test(new URL(r.url()).pathname));
      // Both clicks happen in the page: Playwright's own actions wait for a pending navigation.
      await page.evaluate(() => {
        document.querySelector<HTMLAnchorElement>('header.top a.back')!.click();
        setTimeout(() => {
          sessionStorage.setItem('test:at-link', location.pathname); // the back has not landed
          document
            .querySelector<HTMLAnchorElement>('main a.lrow[href$="/manual/ops/97?mark=32"]')!
            .click();
        }, 300);
      });
      await asked;
      await settle(page, /\/manual\/ops\/97\?mark=32$/);
      expect(await page.evaluate(() => sessionStorage.getItem('test:at-link'))).toMatch(
        /\/switch\/32$/,
      );
      expect(await where(page)).toMatchObject({ url: '/manual/ops/97?mark=32', len: s.len + 1 });
      const prev = await page.evaluate(
        () => JSON.parse(sessionStorage.getItem('tafh:prev') || 'null') as Record<string, unknown>,
      );
      expect(prev.url).toMatch(/\/switch\/32$/);
      expect(prev.back).toBeUndefined();
      expect(prev.replace).toBeUndefined();
      // Opened from another tab, so its back link leads back to the switch.
      await expect(backLink(page)).toHaveAttribute('href', /\/switch\/32$/);
    });
  });
});

test.describe('Diagnose ?q', () => {
  test('Enter writes ?q in place, and Back from a card returns to the results (UX-03, CO-09)', async ({
    page,
  }) => {
    await gotoHydrated(page, './');
    const s = await where(page);
    await field(page).fill('32 68');
    await field(page).press('Enter');
    await expect(page).toHaveURL(/\/\?q=32%2068$/);
    expect(await where(page)).toEqual({ url: '/?q=32%2068', len: s.len, idx: s.idx });

    await card(page).click();
    await settle(page, CARD);
    expect(await where(page)).toMatchObject({ len: s.len + 1, idx: s.idx + 1 });
    await expect(backLink(page)).toHaveText('Results');
    await page.goBack();
    await settle(page, /\/\?q=32%2068$/);
    await expect(field(page)).toHaveValue('32 68');
    await expect(diag(page)).toHaveAttribute('data-mode', 'results');
    expect(await where(page)).toEqual({ url: '/?q=32%2068', len: s.len + 1, idx: s.idx });

    // The header back link from the card traverses too: its target is the entry before.
    await card(page).click();
    await settle(page, CARD);
    await backLink(page).click();
    await settle(page, /\/\?q=32%2068$/);
    expect(await where(page)).toEqual({ url: '/?q=32%2068', len: s.len + 1, idx: s.idx });
    await expect(field(page)).toHaveValue('32 68');
  });

  test('Back to the results lands on the card that was opened (UX2-01)', async ({ page }) => {
    const codes = '11 12 13 14 15 16 17 18 21 22 23 24 25 26 27 28 31 32 33 34';
    const results = new RegExp(`[?]q=${encodeURIComponent(codes)}$`);
    await gotoHydrated(page, `./?q=${encodeURIComponent(codes)}`);
    const opened = page.locator('article.comp h3 a[href$="/switch/32"]');
    await opened.scrollIntoViewIfNeeded();
    await expect(opened).toBeInViewport();
    // By system back, then by the header back link.
    for (const back of [() => page.goBack(), () => backLink(page).click()]) {
      await opened.click();
      await settle(page, CARD);
      await back();
      await settle(page, results);
      await expect(opened).toBeInViewport();
    }
  });

  test('the field losing focus commits, and a card link commits before it leaves', async ({
    page,
  }) => {
    await gotoHydrated(page, './');
    await field(page).fill('32');
    await field(page).blur();
    await expect(page).toHaveURL(/\/\?q=32$/);

    await gotoHydrated(page, './');
    await field(page).fill('68');
    await card(page).click();
    await settle(page, CARD);
    await page.goBack();
    await settle(page, /\/\?q=68$/);
    await expect(field(page)).toHaveValue('68');
    await expect(diag(page)).toHaveAttribute('data-mode', 'results');
  });

  test('typing alone leaves the address; once committed a reload returns to the results', async ({
    page,
  }) => {
    await page.clock.install();
    await gotoHydrated(page, './');
    await field(page).fill('32 68');
    // Past Diagnose's 250 ms URL timer, on the fake clock: typing alone never writes it.
    await page.clock.runFor(300);
    await expect(page).not.toHaveURL(/\?/);
    await page.reload();
    await hydrated(page);
    await expect(field(page)).toHaveValue('');
    await expect(diag(page)).toHaveAttribute('data-mode', 'home');

    await field(page).fill('32 68');
    await field(page).press('Enter');
    await expect(page).toHaveURL(/\/\?q=32%2068$/);
    // Typing on while committed follows, a moment later.
    await field(page).fill('32 68 13');
    await expect(page).toHaveURL(/\/\?q=32%2068%2013$/);
    await page.reload();
    await hydrated(page);
    await expect(field(page)).toHaveValue('32 68 13');
    await expect(diag(page)).toHaveAttribute('data-mode', 'results');
  });

  test('an edit still waiting for its pause is written when the page is hidden or left', async ({
    page,
  }) => {
    await gotoHydrated(page, 'switches');
    await gotoHydrated(page, './');
    await field(page).fill('32');
    await field(page).press('Enter');
    await expect(page).toHaveURL(/\/\?q=32$/);
    // Each step edits the field, then hides or leaves the page inside the 250 ms pause; the
    // address is read in the same task, before the pause could have written it.
    const step = (text: string, event: 'visibilitychange' | 'pagehide') =>
      field(page).evaluate(
        async (t: HTMLTextAreaElement, [text, event]) => {
          t.value = text;
          t.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 0)); // the effect ran; its write is pending
          const before = location.search;
          if (event === 'pagehide') {
            dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
          } else {
            Object.defineProperty(document, 'visibilityState', {
              value: 'hidden',
              configurable: true,
            });
            document.dispatchEvent(new Event('visibilitychange'));
            delete (document as { visibilityState?: unknown }).visibilityState;
          }
          return [before, location.search];
        },
        [text, event] as const,
      );
    expect(await step('32 68', 'visibilitychange')).toEqual(['?q=32', '?q=32%2068']);
    expect(await step('32 68 13', 'pagehide')).toEqual(['?q=32%2068', '?q=32%2068%2013']);

    // For real: system Back inside the pause, then Forward, finds the edit in the entry.
    await field(page).evaluate(async (t: HTMLTextAreaElement) => {
      t.value = '32 68 13 7';
      t.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
      history.back();
    });
    await settle(page, /\/switches$/);
    await page.goForward();
    await settle(page, /\/\?q=32%2068%2013%207$/);
    await expect(field(page)).toHaveValue('32 68 13 7');
  });

  test('an edit pending when the page enters the back/forward cache is written on the restore', async ({
    page,
  }) => {
    await gotoHydrated(page, './');
    await field(page).fill('32');
    await field(page).press('Enter');
    await expect(page).toHaveURL(/\/\?q=32$/);
    // Playwright's Chromium has no bfcache, so the events are dispatched in the order a real
    // browser fires them: pagehide (persisted), then visibilitychange, then pageshow (persisted).
    // A replaceState between the first two would make Chromium evict the page instead.
    const seen = await field(page).evaluate(async (t: HTMLTextAreaElement) => {
      t.value = '32 68';
      t.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0)); // the effect ran; its write is pending
      const out = [location.search];
      dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete (document as { visibilityState?: unknown }).visibilityState;
      out.push(location.search);
      dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      out.push(location.search);
      await new Promise((r) => setTimeout(r, 300)); // the pause ends; nothing else changes
      out.push(location.search);
      return out;
    });
    expect(seen).toEqual(['?q=32', '?q=32', '?q=32%2068', '?q=32%2068']);
  });

  test('a card link followed while the field is not focused commits first', async ({ page }) => {
    await page.clock.install();
    await gotoHydrated(page, './');
    // Text that arrives without the field having focus (Paste): no blur will commit it.
    await field(page).evaluate((t: HTMLTextAreaElement) => {
      t.value = '68';
      t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(diag(page)).toHaveAttribute('data-mode', 'results');
    await expect(field(page)).not.toBeFocused();
    await page.clock.runFor(300);
    await expect(page).not.toHaveURL(/\?/);
    await card(page).click();
    await settle(page, CARD);
    await page.goBack();
    await settle(page, /\/\?q=68$/);
    await expect(field(page)).toHaveValue('68');
    await expect(diag(page)).toHaveAttribute('data-mode', 'results');
  });
});

test('the Map keeps the kind of the selected marker (CO-06)', async ({ page }) => {
  await gotoHydrated(page, 'map?layer=sw,lamp&id=lamp:55');
  const lamp = page.getByRole('button', { name: /^Lamp 55,/ }).first();
  await expect(lamp).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('group', { name: 'Layers' })
    .getByRole('button', { name: /^Solenoids and flashers/ })
    .click();
  await expect(page).toHaveURL(/layer=sw,lamp,coil/);
  await expect(page).toHaveURL(/[?&]id=lamp:55(&|$)/);
  await page.reload();
  await hydrated(page);
  await expect(page.getByRole('button', { name: /^Lamp 55,/ }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: /^Switch 55,/ }).first()).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  // The link builders' bare form still lands on the one layer they name.
  await gotoHydrated(page, 'map?layer=lamp&id=55');
  await expect(page.getByRole('button', { name: /^Lamp 55,/ }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await gotoHydrated(page, 'map?layer=sw&id=32');
  await expect(page.getByRole('button', { name: /^Switch 32,/ }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('a sidebar row keeps the static parent and cross-fades (VL-03)', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'the sidebar rows are desktop only');
  await gotoHydrated(page, 'map');
  await swReady(page);
  await tabLink(page, 'Handbook').click();
  await settle(page, /\/handbook$/);
  const m = await transition(
    page,
    () => page.locator('nav.shell a.sub', { hasText: 'Shopping list' }).click(),
    /\/shopping$/,
    /\/handbook$/,
  );
  expect(m.type).toBe('tab');
  await expect(backLink(page)).toHaveText('Workshop');
  await expect(backLink(page)).toHaveAttribute('href', /\/workshop$/);
  await page.locator('nav.shell a.sub', { hasText: 'Switch matrix' }).click();
  await settle(page, /\/switches$/);
  await expect(backLink(page)).toHaveText('Tables');
  await expect(backLink(page)).toHaveAttribute('href', /\/tables$/);
});

test.describe('transitions', () => {
  test('a back through history pops, and so does a back that replaced', async ({ page }) => {
    await gotoHydrated(page, 'tables');
    await swReady(page);
    await page.locator('main').getByRole('link', { name: 'Switch matrix' }).first().click();
    await settle(page, /\/switches$/);
    const s = await where(page);
    const pop = await transition(
      page,
      () => backLink(page).click(),
      /\/tables$/,
      /\/switches$/,
      () => page.goForward(),
    );
    expect(pop.type).toBe('pop');
    expect(await where(page)).toEqual({ url: '/tables', len: s.len, idx: s.idx - 1 });

    await gotoHydrated(page, 'switch/32');
    const c = await where(page);
    const up = await transition(
      page,
      () => backLink(page).click(),
      /\/switches$/,
      /\/switch\/32$/,
      () => page.evaluate(() => void setTimeout(() => location.replace('switch/32'))),
    );
    expect(up.type).toBe('pop');
    expect(await where(page)).toEqual({ url: '/switches', len: c.len, idx: c.idx });
  });

  test('under reduced motion the pop holds only opacity animations of 150 ms or less', async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await gotoHydrated(page, 'tables');
    await swReady(page);
    await page.locator('main').getByRole('link', { name: 'Switch matrix' }).first().click();
    await settle(page, /\/switches$/);
    const pop = await transition(
      page,
      () => backLink(page).click(),
      /\/tables$/,
      /\/switches$/,
      () => page.goForward(),
    );
    expect(pop.type).toBe('pop');
    expect(pop.animations.length).toBeGreaterThan(0);
    for (const a of pop.animations) {
      expect(a.duration, a.name).toBeLessThanOrEqual(150);
      expect(a.props, a.name).toEqual(['opacity']);
    }
    await context.close();
  });
});

test('a page restored from the back/forward cache drops a stale slide and re-points its tabs (CO-07)', async ({
  page,
}) => {
  await gotoHydrated(page, 'switches');
  await page.locator('main a[data-cell="32"]').first().click();
  await settle(page, /\/switch\/32$/);
  // Playwright's Chromium has no bfcache, so this stands in for a restore: the state a swipe left
  // behind, and a Map view opened in the pages in between.
  await page.evaluate(() => {
    const main = document.getElementById('main')!;
    main.style.transform = 'translateX(120px)';
    main.classList.add('swiping');
    const nav = JSON.parse(sessionStorage.getItem('tafh:nav') || '{}') as {
      tabs?: Record<string, string>;
    };
    nav.tabs = { ...nav.tabs, map: location.pathname.replace(/switch\/32$/, 'map?layer=lamp') };
    sessionStorage.setItem('tafh:nav', JSON.stringify(nav));
    dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('#main')).toHaveCSS('transform', 'none');
  await expect(page.locator('#main')).not.toHaveClass(/swiping/);
  await expect(tabLink(page, 'Map')).toHaveAttribute('href', /\/map\?layer=lamp$/);
  // The tab links still count this page as the Tables tab's last view.
  const tabs = await page.evaluate(
    () => (JSON.parse(sessionStorage.getItem('tafh:nav') || '{}') as { tabs: object }).tabs,
  );
  expect(tabs).toMatchObject({ tables: expect.stringMatching(/\/switch\/32$/) });
});

test.describe('without the Navigation API', () => {
  // On the context, so a tab the page opens runs without it too.
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      const w = window as unknown as { navigation?: unknown };
      // WebKit runs this twice on a window the page opens (about:blank, then the document);
      // the second run must keep the first stash, not stash the undefined the first left.
      if ('__nav' in w) return;
      Object.defineProperty(window, '__nav', { value: w.navigation, configurable: true });
      Object.defineProperty(window, 'navigation', {
        value: undefined,
        configurable: true,
        writable: true,
      });
    });
  });

  test('the back link traverses through the stamped previous entry; a cold link replaces', async ({
    page,
  }) => {
    // Chromium reports an aborted transition it never handed to the page (no `viewTransition` on
    // pagereveal) as an unhandled rejection in the new page; that is not this page's code.
    const errors = pageErrors(page);
    await gotoHydrated(page, 'switches');
    expect(
      await page.evaluate(() => !(window as unknown as { navigation?: unknown }).navigation),
    ).toBe(true);
    const s = await where(page);
    await page.locator('main a[data-cell="32"]').first().click();
    await settle(page, /\/switch\/32$/);
    await backLink(page).click();
    await settle(page, /\/switches$/);
    expect(await where(page)).toEqual({ url: '/switches', len: s.len + 1, idx: s.idx });

    await gotoHydrated(page, 'switch/32');
    const c = await where(page);
    await backLink(page).click();
    await settle(page, /\/switches$/);
    expect(await where(page)).toEqual({ url: '/switches', len: c.len, idx: c.idx });
    expect(errors).toEqual([]);
  });

  test('in a new tab opened from an app link the back link replaces, as no entry is before', async ({
    page,
    context,
  }) => {
    await gotoHydrated(page, 'switches');
    const cell = await page.locator('main a[data-cell="32"]').first().getAttribute('href');
    const [tab] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate((u) => void window.open(u!), cell),
    ]);
    await settle(tab, /\/switch\/32$/);
    expect(
      await tab.evaluate(() => !(window as unknown as { navigation?: unknown }).navigation),
    ).toBe(true);
    expect(await where(tab)).toEqual({ url: '/switch/32', len: 1, idx: 0 });
    await backLink(tab).click();
    await settle(tab, /\/switches$/);
    expect(await where(tab)).toEqual({ url: '/switches', len: 1, idx: 0 });
    await tab.close();
  });

  test('a page turned keeps the entry before, so the back link still traverses (UX-04)', async ({
    page,
  }) => {
    await gotoHydrated(page, 'handbook/tests');
    const s = await where(page);
    await page
      .locator('main')
      .getByRole('link', { name: /^Manual (p\.|PDF page) / })
      .first()
      .click();
    await settle(page, /\/manual\/ops\/\d+$/);
    const first = Number(/(\d+)$/.exec(page.url())![1]);
    await page.keyboard.press('ArrowRight');
    await settle(page, new RegExp(`/manual/ops/${first + 1}$`));
    await page.getByRole('link', { name: 'Next page' }).first().click();
    await settle(page, new RegExp(`/manual/ops/${first + 2}$`));
    expect(await where(page)).toMatchObject({ len: s.len + 1, idx: s.idx + 1 });
    await expect(backLink(page)).toHaveText('Test menu');
    await backLink(page).click();
    await settle(page, /\/handbook\/tests$/);
    expect(await where(page)).toEqual({ url: '/handbook/tests', len: s.len + 1, idx: s.idx });
  });
});

/* On both phone engines: WebKit is the engine of the owner's installed iPhone app (TT3-03). */
test.describe('swipe back', () => {
  test.skip(({ isMobile }) => !isMobile, 'a touch gesture');

  /** A finger from the left edge to 45% of the width at y = 400, in twelve steps. */
  const far = (page: Page) => {
    const w = page.viewportSize()!.width;
    return Array.from({ length: 12 }, (_, i) => [
      { x: 8 + Math.round((i * w * 0.45) / 11), y: 400 },
    ]);
  };
  /* A running view transition takes the touches (they reach the document, not #main), so a
     swipe waits for the push that brought the page to finish, as a finger would. */
  const still = (page: Page) =>
    expect
      .poll(() =>
        page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((a) =>
                (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith('::view-transition'),
              ).length,
        ),
      )
      .toBe(0);
  const swipe = async (page: Page) => {
    await still(page);
    await touchDrag(page, far(page));
  };

  test('traverses to the entry before, and only fades', async ({ page }) => {
    await gotoHydrated(page, 'switches');
    await swReady(page);
    const s = await where(page);
    await page.locator('main a[data-cell="32"]').first().click();
    await settle(page, /\/switch\/32$/);
    await swipe(page);
    await settle(page, /\/switches$/);
    expect(await where(page)).toEqual({ url: '/switches', len: s.len + 1, idx: s.idx });
    // The page already slid out, so the traversal picks a fade, not the pop a traversal gets.
    // (Phone emulation then aborts the transition itself, "Viewport size changed", so this reads
    // the type the page chose, run or not.)
    await expect.poll(async () => (await motion(page))?.type).toBe('fade');
    await page.goForward();
    await settle(page, /\/switch\/32$/);
    expect(await where(page)).toEqual({ url: '/switch/32', len: s.len + 1, idx: s.idx + 1 });
  });

  test('on a cold link replaces the page', async ({ page }) => {
    await gotoHydrated(page, 'switch/32');
    const s = await where(page);
    await swipe(page);
    await settle(page, /\/switches$/);
    expect(await where(page)).toEqual({ url: '/switches', len: s.len, idx: s.idx });
  });

  test('from a Diagnose card returns to the results', async ({ page }) => {
    await gotoHydrated(page, './');
    const s = await where(page);
    await field(page).fill('32');
    await field(page).press('Enter');
    await expect(page).toHaveURL(/\/\?q=32$/);
    await card(page).click();
    await settle(page, CARD);
    await swipe(page);
    await settle(page, /\/\?q=32$/);
    await expect(field(page)).toHaveValue('32');
    await expect(diag(page)).toHaveAttribute('data-mode', 'results');
    expect(await where(page)).toEqual({ url: '/?q=32', len: s.len + 1, idx: s.idx });
  });

  test('a cancelled touch springs back and never navigates', async ({ page }) => {
    await page.clock.install();
    await gotoHydrated(page, 'switch/32');
    const s = await where(page);
    await still(page);
    const navs = await countNavigations(page);
    await touchDrag(page, far(page), { end: 'touchCancel' });
    await expect(page.locator('#main')).toHaveCSS('transform', 'none');
    // Past the 300 ms swipe timer, on the fake clock: no navigation was started.
    await page.clock.runFor(350);
    expect(await navs()).toBe(0);
    expect(await where(page)).toEqual(s);
  });
});

/* Audit P2 item 12, UX3-07: the Map is a tab root with no static parent, so opened from a card it
   had no back affordance in the installed app on iOS. It now shows one to the page it came from. */
test.describe('the Map opened from a card', () => {
  test('shows a Results back link that returns to the results', async ({ page }) => {
    await gotoHydrated(page, '/?q=32');
    await page
      .locator('article.comp[data-id="32"]')
      .getByRole('link', { name: 'Show on map' })
      .click();
    await settle(page, /\/map\?/);
    await expect(backLink(page)).toHaveText('Results');
    await expect(backLink(page)).toHaveAttribute('href', /\/\?q=32$/);
    await backLink(page).click();
    await settle(page, /\/\?q=32$/);
    await expect(diag(page)).toHaveAttribute('data-mode', 'results');
  });

  test('from the tab bar it has none', async ({ page }) => {
    await gotoHydrated(page, '/?q=32');
    await page.locator('nav.shell a.tab[data-tab="map"]').click();
    await settle(page, /\/map(\?.*)?$/);
    await expect(backLink(page)).toHaveCount(0);
  });
});
