import { TABS } from '~/lib/nav';
import {
  backOverride,
  readPrev,
  readState,
  swipeCommits,
  writePrev,
  writeState,
  type Visit,
} from '~/lib/nav-state';

/**
 * Navigation continuity in the page (spec §10, Phase 12). Base.astro loads this once per page:
 * each tab-bar link opens its tab's last view, a returning view lands at its old scroll offset, a
 * page pushed from another tab points its back link there, and a left-edge swipe pops the view.
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

const prev = readPrev(sessionStorage);
const state = readState(sessionStorage);
if (tab) state.tabs[tab] = url;
writeState(sessionStorage, state);

let viaTab = false;
let swipe = false;

// Tab links open the tab's last view; the current tab's link stays on its root (reselect).
for (const a of document.querySelectorAll<HTMLAnchorElement>('nav.shell a.tab')) {
  const key = a.dataset.tab ?? '';
  const top = state.tabs[key];
  if (key !== tab && top) a.href = top;
  a.addEventListener('click', (e) => {
    setTimeout(() => (viaTab = !e.defaultPrevented), 0);
  });
}

// The scroll offset comes back with the view (not when a hash asks for a place).
const saved = state.scroll[url];
if (saved && !location.hash) {
  const restore = () => {
    if (Math.abs(scrollY - saved) > 1) scrollTo(0, saved);
  };
  restore();
  addEventListener('load', restore, { once: true });
}

// A page pushed from another tab goes back to where it came from.
const back = document.querySelector<HTMLAnchorElement>('header.top a.back');
const over = backOverride(prev, { tab, url });
if (back && over) {
  back.href = over.href;
  const text = back.querySelector('span');
  if (text) text.textContent = over.label;
}

const leave = () => {
  // A component may name the URL its state answers to (Diagnose: `?q=`) without writing it.
  const now = document.body.dataset.url || here();
  const visit: Visit = {
    url: now,
    tab,
    depth,
    label: document.body.dataset.view || TAB_LABEL[tab] || document.title,
  };
  if (viaTab) visit.viaTab = true;
  if (swipe) visit.swipe = true;
  writePrev(sessionStorage, visit);
  state.scroll[now] = Math.round(scrollY);
  if (tab) state.tabs[tab] = now;
  writeState(sessionStorage, state);
};
addEventListener('pagehide', leave);

// Swipe back (spec §10): from the left edge, tracking the finger; commit past 35% of the width
// or above 500 px/s, otherwise spring back. The listeners are passive, like pull-to-refresh: a
// vertical start is left to the scroller, a horizontal one has nothing else to take it.
const main = document.getElementById('main');
if (back && main) {
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
  main.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (!t || e.touches.length !== 1) {
        x0 = -1;
        return;
      }
      const left = main.getBoundingClientRect().left;
      x0 = t.clientX - left <= EDGE ? t.clientX : -1;
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
  const end = (e: TouchEvent) => {
    if (x0 < 0) return;
    x0 = -1;
    if (!active) return;
    active = false;
    main.classList.remove('swiping');
    if (e.timeStamp - lastT > 100) velocity = 0; // the finger rested before lifting
    if (swipeCommits(dx, main.clientWidth, velocity)) {
      swipe = true;
      if (reduce.matches) {
        location.assign(back.href);
        return;
      }
      main.style.transition = 'transform var(--dur-3) var(--ease-exit)';
      move(main.clientWidth);
      setTimeout(() => location.assign(back.href), 300);
    } else {
      main.style.transition = reduce.matches ? 'none' : 'transform 250ms var(--ease-emphasized)';
      move(0);
      setTimeout(() => (main.style.transition = ''), 260);
    }
  };
  main.addEventListener('touchend', end);
  main.addEventListener('touchcancel', end);
}
