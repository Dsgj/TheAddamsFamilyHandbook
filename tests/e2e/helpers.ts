import { expect, test, type Locator, type Page } from '@playwright/test';

/** The page's runtime errors from here on. WebKit logs every fetch a navigation cancels as a page
 * error (Playwright splits the text at its first colon: name 'Fetch API cannot load http',
 * message '//<host>/<path> due to access control checks.'). The warm-up (pwa.ts) aborts its
 * fetches on a cross-document navigate event and on pagehide, which covers a link and back; a
 * page.goto is the address bar, whose load cancels them before either event fires. Gated by name
 * on WebKit, for the page's own host only (spec, Playwright projects). */
export function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  const webkit = page.context().browser()?.browserType().name() === 'webkit';
  page.on('pageerror', (e) => {
    const m =
      webkit && e.name === 'Fetch API cannot load http'
        ? /^\/*([^/\s]+)\/\S* due to access control checks\.$/.exec(e.message)
        : null;
    if (m && m[1] === new URL(page.url()).host) return;
    errors.push(String(e));
  });
  return errors;
}

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
 * `client:visible` ones stay server-rendered off screen (see hydrateVisible). A `client:idle` island
 * waits for an idle moment: the Workshop tab badge (every page) 200 ms at most, ReaderBar (a
 * Handbook section) as long as it takes, which a busy CI runner can hold off past expect's 5 s,
 * hence the longer wait.
 */
export async function hydrated(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            !document.querySelector('astro-island[ssr]:is([client="load"], [client="idle"])') &&
            [...document.querySelectorAll('astro-island[ssr][client="media"]')].every(
              (el) =>
                !matchMedia(JSON.parse(el.getAttribute('opts') ?? '{}').value ?? 'not all').matches,
            ),
        ),
      { timeout: 15_000 },
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
 * as `history.back()` or `location.replace()` is called, before anything loads (Chromium). Without
 * the API (WebKit) the count stays 0 while this document is still here, and the document a
 * navigation replaced it with reads -1, the "no count" value.
 */
export async function countNavigations(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { navs: number; navigation?: EventTarget };
    w.navs = 0;
    w.navigation?.addEventListener('navigate', () => w.navs++);
  });
  return () => page.evaluate(() => (window as unknown as { navs?: number }).navs ?? -1);
}

/** One finger's point on the screen, in CSS pixels. */
export interface Finger {
  x: number;
  y: number;
}
type Phase = 'start' | 'move' | 'end' | 'cancel';

/**
 * A touch gesture, step by step (audit TT3-02, TT3-03, TT3-10): `frames[i]` holds every finger's
 * point at step i, one per finger in a fixed order; the first frame puts them down, the last is
 * where they lift. `pause` ms pass between steps and before the lift, since the spacing of the
 * events is the input (a swipe's velocity, a double tap's window). Chromium gets real touches
 * through CDP, so its own gesture handling (touch-action, scrolling, the pointer events a touch
 * produces) is in the loop. WebKit has no multi-touch input in Playwright, so it gets what a finger
 * produces, dispatched in the page: a PointerEvent per finger (pointerType touch, the first finger
 * primary) on the element under it, and one duck-typed touch event per step whose `touches`,
 * `targetTouches` and `changedTouches` carry clientX/clientY, on the element the first finger
 * landed on; that is all the app reads (motion.ts's swipe, zoom.svelte.ts's pinch and taps).
 * `end` is the lift, or the system taking the touch; `beforeEnd` runs between the last move and
 * the lift, for a look at the page mid-gesture.
 */
export async function touchDrag(
  page: Page,
  frames: Finger[][],
  {
    pause = 30,
    end = 'touchEnd',
    beforeEnd,
  }: { pause?: number; end?: 'touchEnd' | 'touchCancel'; beforeEnd?: () => Promise<void> } = {},
) {
  const [first, ...moves] = frames;
  if (!first) throw new Error('touchDrag: no frames');
  const wait = async () => {
    // eslint-disable-next-line playwright/no-wait-for-timeout -- gesture pacing: the spacing of the touch events is the input
    if (pause) await page.waitForTimeout(pause);
  };
  const CDP = {
    start: 'touchStart',
    move: 'touchMove',
    end: 'touchEnd',
    cancel: 'touchCancel',
  } as const;
  const chromium = page.context().browser()?.browserType().name() === 'chromium';
  const cdp = chromium ? await page.context().newCDPSession(page) : undefined;
  const step = (phase: Phase, points: Finger[]) =>
    cdp
      ? cdp.send('Input.dispatchTouchEvent', {
          type: CDP[phase],
          touchPoints: phase === 'start' || phase === 'move' ? points : [],
        })
      : page.evaluate(synthetic, { phase, points });
  await step('start', first);
  for (const f of moves) {
    await wait();
    await step('move', f);
  }
  await wait();
  await beforeEnd?.();
  await step(end === 'touchCancel' ? 'cancel' : 'end', frames[frames.length - 1]!);
  await cdp?.detach();
}

/** In the page: what one step of a touch gesture produces, for an engine Playwright cannot touch. */
function synthetic({ phase, points }: { phase: Phase; points: Finger[] }) {
  interface Held {
    el: Element;
    x: number;
    y: number;
  }
  const w = window as unknown as { __fingers?: Held[] | undefined };
  const under = (p: Finger) => document.elementFromPoint(p.x, p.y) ?? document.documentElement;
  const held =
    phase === 'start' ? points.map((p) => ({ el: under(p), x: p.x, y: p.y })) : (w.__fingers ?? []);
  for (const [i, h] of held.entries()) {
    const p = points[i];
    if (p && phase !== 'start') Object.assign(h, { x: p.x, y: p.y });
  }
  const down = phase === 'start' || phase === 'move';
  w.__fingers = down ? held : undefined;
  const pointer = {
    start: 'pointerdown',
    move: 'pointermove',
    end: 'pointerup',
    cancel: 'pointercancel',
  };
  const touch = { start: 'touchstart', move: 'touchmove', end: 'touchend', cancel: 'touchcancel' };
  // Pointer events go to the element under each finger: a tap's target is read from pointerup.
  for (const [i, h] of held.entries()) {
    (phase === 'start' ? h.el : under(h)).dispatchEvent(
      new PointerEvent(pointer[phase], {
        bubbles: true,
        cancelable: phase !== 'cancel',
        composed: true,
        pointerId: i + 1,
        pointerType: 'touch',
        isPrimary: i === 0,
        clientX: h.x,
        clientY: h.y,
        screenX: h.x,
        screenY: h.y,
        button: phase === 'move' ? -1 : 0,
        buttons: down ? 1 : 0,
        width: 1,
        height: 1,
        pressure: down ? 0.5 : 0,
      }),
    );
  }
  // The touch event keeps the target a touch started on, as the Touch Events spec has it.
  const target = held[0]?.el ?? document.documentElement;
  const touches = held.map((h, i) => ({
    identifier: i,
    target: h.el,
    clientX: h.x,
    clientY: h.y,
    pageX: h.x + scrollX,
    pageY: h.y + scrollY,
    screenX: h.x,
    screenY: h.y,
  }));
  const e = new Event(touch[phase], {
    bubbles: true,
    cancelable: phase !== 'cancel',
    composed: true,
  });
  Object.defineProperties(e, {
    touches: { value: down ? touches : [] },
    targetTouches: { value: down ? touches.filter((t) => t.target === target) : [] },
    changedTouches: { value: touches },
  });
  target.dispatchEvent(e);
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

/** A navigation the page started (a click, history) has landed and the new page is live. */
export async function settle(page: Page, url: RegExp) {
  await expect(page).toHaveURL(url);
  await page.waitForLoadState('load');
  await hydrated(page);
}

/** What motion.ts records of the cross-document view transition that brought the page in. */
interface Motion {
  type: string;
  animations: { name: string; duration: number; props: string[] }[];
  pending?: boolean;
  skipped?: boolean;
}

/* While the worker precaches on a first visit, Chrome skips the cross-document transition (a
   plain swap); the tests that read the transition wait for it, as an installed app has. */
export const swReady = (page: Page) =>
  page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

export const motion = (page: Page) =>
  page.evaluate(() => (window as unknown as { tafhMotion?: Motion }).tafhMotion ?? null);

/* The transition, once it has run, for motion.spec.ts and back.spec.ts alike (audit TT2-05).
   Chrome drops a cross-document transition under CPU load (a known flake of the test machine,
   not of the app; audit TT-04): the page being left fires `pageswap` with a view transition, yet
   the new page's `pagereveal` gets none (`type: 'none'`), with the new page painted in 50-200 ms
   (not the 4 s timeout), visible and with nothing in the console. Measured on a 16-thread laptop
   for a link push: 1 attempt in 11 dropped with one worker, 7 in 17 (desktop) and about 6 in 10
   (phone) with ten; history traversals (the pop) were never dropped. So the test undoes the step
   (a back, or after a back that went through history a forward) and makes the same navigation
   again, up to 20 times, and records each drop as an annotation in the report. Each step settles
   (load, then the islands): motion.ts must have run before the next click, since its back-link
   and pagehide handlers decide pop against fade. Most of those drops were Chromium aborting the
   inbound transition before the stylesheet with the opt-in had loaded (UX3-12, P3 item 4: the
   opt-in is the head's first style now); the retry stays for a real drop under load. */
export async function transition(
  page: Page,
  go: () => Promise<unknown>,
  to: RegExp,
  from: RegExp,
  undo: () => Promise<unknown> = () => page.goBack(),
) {
  const seen: string[] = [];
  for (let attempt = 0; attempt < 20; attempt++) {
    await go();
    await settle(page, to);
    await expect.poll(async () => (await motion(page))?.type).toBeTruthy();
    await expect.poll(async () => (await motion(page))?.pending).toBeFalsy();
    const m = (await motion(page))!;
    if (m.type !== 'none' && !m.skipped) return m;
    seen.push(m.skipped ? `${m.type} (skipped)` : m.type);
    test.info().annotations.push({
      type: 'dropped view transition',
      description: `${to}: ${seen.at(-1)}`,
    });
    await undo();
    await settle(page, from);
    await expect.poll(async () => (await motion(page))?.type).toBeTruthy();
  }
  throw new Error(`Chrome dropped the transition 20 times over: ${seen.join(', ')}`);
}
