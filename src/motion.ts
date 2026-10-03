import { TABS } from '~/lib/nav';
import {
  BACK_GUARD_MS,
  backAction,
  previousUrl,
  readEntry,
  readPrev,
  readState,
  resolveBack,
  swipeCommits,
  withEntry,
  writePrev,
  writeState,
  type BackLink,
  type NavApi,
  type Visit,
} from '~/lib/nav-state';
import { replacePage } from '~/lib/url';

/**
 * Navigation continuity in the page (spec §10, Phase 12, audit P1 item 7). Base.astro loads this
 * once per page: each tab-bar link opens its tab's last view, a returning view lands at its old
 * scroll offset, a page opened from elsewhere points its back link there, and the header back
 * link and a left-edge swipe go back through history when the previous entry is where they lead
 * (else they replace this entry, so Back never returns to a dismissed page).
 * The view-transition type itself is set in Base's inline `pagereveal` script, which must run
 * before the first render; this module writes the record that script reads (`tafh:prev`).
 */
const html = document.documentElement;
const tab = html.dataset.tab ?? '';
const depth = Number(html.dataset.depth ?? 0);
const here = () => location.pathname + location.search;
const url = here();
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const TAB_LABEL: Record<string, string> = Object.fromEntries(TABS.map((t) => [t.key, t.label]));
/** The Navigation API, when the browser has it (tested by truthiness, so a test can hide it). */
const navApi = () =>
  (window as unknown as { navigation?: NavApi & { activation?: { navigationType: string } } })
    .navigation;
const plain = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented;
const pathOf = (u: string) => {
  const x = new URL(u, location.href);
  return x.pathname + x.search;
};
/** A plain click on `a` loads another document in this tab (not a new tab, a download, a hash). */
const leavesHere = (a: Element, e: MouseEvent) =>
  a instanceof HTMLAnchorElement &&
  plain(e) &&
  a.hasAttribute('href') &&
  !a.hasAttribute('download') &&
  (!a.target || a.target === '_self') &&
  !(a.hash && a.pathname === location.pathname && a.search === location.search);

// With site data blocked the `sessionStorage` getter itself throws. Then nothing is kept across
// pages (tab memory, scroll), but the back link, swipe and reselect still run (CO2-11).
const store: Pick<Storage, 'getItem' | 'setItem'> = (() => {
  try {
    return sessionStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
})();

const prev = readPrev(store);
let state = readState(store);
if (tab) state.tabs[tab] = url;
writeState(store, state);

let viaTab = false;
let swipe = false;
/** Set when the header back link or a swipe leaves; 'replace' when it replaced this entry. */
let leaving: null | 'back' | 'replace' = null;
let backAt = -Infinity;

// Tab links open the tab's last view; the current tab's link stays on its root (reselect).
const tabLinks = [...document.querySelectorAll<HTMLAnchorElement>('nav.shell a.tab')];
const roots = new Map(tabLinks.map((a) => [a, a.getAttribute('href') ?? '']));
const pointTabs = () => {
  for (const a of tabLinks) {
    const key = a.dataset.tab ?? '';
    const top = state.tabs[key];
    a.href = key !== tab && top ? top : (roots.get(a) ?? a.href);
  }
};
pointTabs();

document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest?.('a');
  if (!a) return;
  // A link followed while a back or a page turn is still loading overtakes it, so this page is
  // left by that link: drop the marks the unfinished navigation set.
  if (a !== back && leavesHere(a, e)) {
    leaving = null;
    delete html.dataset.leave;
  }
  // Any link in the shell (tab, sidebar row, logo) keeps the static parent and cross-fades. This
  // listener is on the document, so Base's reselect handler on the shell has already run.
  if (a.closest('nav.shell')) viaTab = plain(e);
  // Manual paging replaces this entry (PageViewer's Prev/Next, the viewer's contents rows).
  if (a.matches('a[data-replace][href]') && plain(e)) {
    e.preventDefault();
    replacePage(a.href);
  }
});

// The scroll offset comes back with the view (not when a hash asks for a place). An island that
// renders the page's content after load, like Diagnose's results, says so with `tafh:content`, and
// the offset is put back once more then, unless the reader has moved the page since (UX2-01).
const saved = state.scroll[url];
if (saved && !location.hash) {
  let moved = false;
  const restore = () => {
    if (!moved && Math.abs(scrollY - saved) > 1) scrollTo(0, saved);
  };
  restore();
  addEventListener('load', restore, { once: true });
  document.addEventListener('tafh:content', restore, { once: true });
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
    addEventListener(type, () => (moved = true), { once: true, capture: true, passive: true });
}

// The back link this entry was given when it was created, else the one this load decides.
const back = document.querySelector<HTMLAnchorElement>('header.top a.back');
const text = back?.querySelector('span');
const setBack = (link: BackLink) => {
  if (!back) return;
  back.href = link.href;
  if (text) text.textContent = link.label;
};
const activation = navApi()?.currentEntry ? navApi()?.activation : undefined;
const timing = performance.getEntriesByType('navigation')[0] as
  PerformanceNavigationTiming | undefined;
const resolved = resolveBack({
  stored: readEntry(history.state),
  navType: activation?.navigationType || timing?.type || '',
  prev,
  cur: { tab, depth, url, staticHref: back?.getAttribute('href') ?? '' },
  load: {
    now: Date.now(),
    referrer: document.referrer,
    origin: location.origin,
    histLen: history.length,
  },
});
if (resolved.link) setBack(resolved.link);
if (resolved.entry) {
  try {
    // No URL argument: a component may already have rewritten it (Diagnose `?q=`, the Map).
    history.replaceState(withEntry(history.state, resolved.entry), '');
  } catch {
    /* throttled: the link still shows, only a reload would forget it */
  }
}

/**
 * Back to `target`, once per page: traverse when the previous entry is that page, else replace
 * this entry with it. A cold deep link has no previous entry here, so it replaces; the app never
 * steps back out of itself.
 */
function goBack(target: string) {
  const now = performance.now();
  if (now - backAt < BACK_GUARD_MS) return;
  backAt = now;
  delete html.dataset.leave; // a page turn still loading is overtaken
  if (backAction(target, previousUrl(navApi(), history.state, history.length)) === 'traverse') {
    leaving = 'back';
    history.back();
  } else {
    leaving = 'replace';
    location.replace(target);
  }
}
back?.addEventListener('click', (e) => {
  if (!plain(e)) return; // a new tab or window keeps the link's own behaviour
  e.preventDefault();
  goBack(back.href);
});

const leave = () => {
  // A component may name the URL its state answers to (Diagnose: `?q=`) without writing it.
  const now = document.body.dataset.url || here();
  const visit: Visit = {
    url: now,
    tab,
    depth,
    label: document.body.dataset.view || html.dataset.label || TAB_LABEL[tab] || document.title,
    at: Date.now(),
  };
  if (viaTab) visit.viaTab = true;
  if (swipe) visit.swipe = true;
  if (leaving) visit.back = true;
  if (leaving === 'replace' || html.dataset.leave === 'replace') {
    visit.replace = true;
    // The page taking this entry's place has the same entry before it.
    const from = readEntry(history.state)?.from;
    if (from) visit.from = from;
  }
  if (back) visit.backLink = { href: pathOf(back.href), label: text?.textContent ?? '' };
  writePrev(store, visit);
  // Read-modify-write: pages opened since this one loaded (or since a restore) wrote their tabs.
  state = readState(store);
  state.scroll[now] = Math.round(scrollY);
  if (tab) state.tabs[tab] = now;
  writeState(store, state);
};
addEventListener('pagehide', leave);

// Swipe back (spec §10): from the left edge, tracking the finger; commit past 35% of the width
// or above 500 px/s, otherwise spring back. The listeners are passive, like pull-to-refresh: a
// vertical start is left to the scroller, a horizontal one has nothing else to take it. An iOS
// Safari tab (`navigator.standalone === false`) has its own edge swipe through history, so the
// custom one runs only in the installed app and on other platforms.
const main = document.getElementById('main');
let swipeTimer: ReturnType<typeof setTimeout> | undefined;
let resetSwipe = () => {};
if (back && main && (navigator as { standalone?: boolean }).standalone !== false) {
  const EDGE = 24;
  let x0 = -1;
  let y0 = 0;
  let dx = 0;
  let active = false;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  const move = (x: number) => {
    main.style.transform = x ? `translateX(${x}px)` : '';
  };
  const springBack = () => {
    main.style.transition = reduce.matches
      ? 'none'
      : 'transform var(--dur-3) var(--ease-emphasized)';
    move(0);
    // --dur-3 is 300ms; clear the transition just after it ends.
    setTimeout(() => (main.style.transition = ''), 310);
  };
  resetSwipe = () => {
    x0 = -1;
    active = false;
  };
  // Not through an open modal sheet, and not from a surface that pans sideways: one marked
  // `data-no-swipe` (a zoomed manual page) or one already scrolled off its start, like a wide
  // table (CR2-01).
  const held = (target: EventTarget | null) => {
    if (document.querySelector('[aria-modal="true"]')) return true;
    let el = target instanceof Element ? target : null;
    while (el && el !== main) {
      if (el.scrollLeft > 0 || el.hasAttribute('data-no-swipe')) return true;
      el = el.parentElement;
    }
    return false;
  };
  main.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (!t || e.touches.length !== 1) {
        x0 = -1;
        return;
      }
      const left = main.getBoundingClientRect().left;
      x0 = t.clientX - left <= EDGE && !held(e.target) ? t.clientX : -1;
      y0 = t.clientY;
      dx = 0;
      velocity = 0;
      active = false;
      lastX = t.clientX;
      lastT = e.timeStamp;
    },
    { passive: true },
  );
  main.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (x0 < 0 || !t) return;
      const mx = t.clientX - x0;
      const my = t.clientY - y0;
      if (!active) {
        if (Math.abs(my) > 8 && Math.abs(my) > Math.abs(mx)) {
          x0 = -1;
          return;
        }
        if (mx < 8) return;
        active = true;
        main.classList.add('swiping');
        main.style.transition = 'none';
      }
      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = ((t.clientX - lastX) / dt) * 1000;
      lastX = t.clientX;
      lastT = e.timeStamp;
      dx = Math.max(0, mx);
      move(dx);
    },
    { passive: true },
  );
  main.addEventListener('touchend', (e) => {
    if (x0 < 0) return;
    x0 = -1;
    if (!active) return;
    active = false;
    main.classList.remove('swiping');
    if (e.timeStamp - lastT > 100) velocity = 0; // the finger rested before lifting
    if (!swipeCommits(dx, main.clientWidth, velocity)) {
      springBack();
      return;
    }
    swipe = true;
    if (reduce.matches) {
      goBack(back.href);
      return;
    }
    main.style.transition = 'transform var(--dur-3) var(--ease-exit)';
    move(main.clientWidth);
    swipeTimer = setTimeout(() => goBack(back.href), 300);
  });
  // The system took the touch (iOS starts its own edge swipe): never commit, spring back.
  main.addEventListener('touchcancel', () => {
    if (x0 < 0) return;
    x0 = -1;
    if (!active) return;
    active = false;
    main.classList.remove('swiping');
    springBack();
  });
}

// A page restored from the back/forward cache keeps its JS state: the slide a swipe left behind,
// a pending swipe timer, the leave flags, and tab links from before the pages opened since.
addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  clearTimeout(swipeTimer);
  swipeTimer = undefined;
  resetSwipe();
  if (main) {
    main.style.transform = '';
    main.style.transition = '';
    main.classList.remove('swiping');
  }
  viaTab = false;
  swipe = false;
  leaving = null;
  backAt = -Infinity;
  delete html.dataset.leave;
  state = readState(store);
  if (tab) state.tabs[tab] = document.body.dataset.url || here();
  writeState(store, state);
  pointTabs();
});
