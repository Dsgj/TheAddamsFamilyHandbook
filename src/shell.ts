import { REDUCED } from '~/lib/bp';
import { emit } from '~/lib/events';
import { norm } from '~/lib/nav-state';

/**
 * The shell's behaviour once the page is parsed (audit AR3-18, PF3-06; until round 3 an inline
 * script at the end of Base.astro's body): the large title's collapse (spec §6.5), the back link's
 * `data-bare`, and the current tab's reselect (spec §6.1). A module like motion.ts: typed, sharing
 * `norm`, `emit` and the motion query instead of copying them, fetched once and precached instead
 * of travelling in every page. Deferred, it runs after the parse, as the inline did.
 */

const top = document.querySelector<HTMLElement>('header.top');
const lt = document.querySelector<HTMLElement>('main > .lt');
const own = top?.dataset.h1 === 'page' ? document.querySelector<HTMLElement>('main h1') : null;

// The large title collapses over the first 52 px of scroll: the compact title fades in between 40
// and 52 and the hairline appears at 52. Under reduced motion the titles swap at 52. A page with
// its own h1 (data-h1="page") runs the same fade off that h1 instead, over its last 12 px under
// the bar, so the bar never repeats a title that is still on screen (audit P2 item 9); with no h1
// to wait for, the title just shows.
if (top && top.dataset.h1 === 'page' && !own) top.style.setProperty('--ct', '1');
if (top && (lt || own)) {
  const reduce = matchMedia(REDUCED);
  let queued = false;
  const apply = () => {
    queued = false;
    // For an own h1, y is how far its bottom edge has come up the bar's last 52 px.
    const y = lt
      ? Math.max(0, window.scrollY)
      : own
        ? 52 - (own.getBoundingClientRect().bottom - top.getBoundingClientRect().bottom)
        : 52;
    const done = y >= 52;
    const ct = reduce.matches ? (done ? 1 : 0) : Math.min(1, Math.max(0, (y - 40) / 12));
    top.style.setProperty('--ct', String(ct));
    if (lt) {
      const large = reduce.matches ? (done ? 0 : 1) : Math.max(0, 1 - y / 52);
      lt.style.setProperty('--lt', String(large));
    }
    top.toggleAttribute('data-collapsed', done);
  };
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  };
  apply();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  reduce.addEventListener('change', apply);
}

// Under 1280 a back label too long for its side wraps out of the link and only the chevron shows
// (layout.css, VP-03/AY-13). data-bare mirrors that, so the focus ring and the hover pill go round
// the chevron. The link and the label both resize whenever the label wraps, returns or is
// rewritten (motion.ts), so observing the two is enough.
const back = document.querySelector<HTMLAnchorElement>('header.top a.back');
const label = back?.querySelector('span');
if (back && label && 'ResizeObserver' in window) {
  const bare = new ResizeObserver(() => {
    const gone = label.getBoundingClientRect().top >= back.getBoundingClientRect().bottom - 0.5;
    back.toggleAttribute('data-bare', gone);
  });
  bare.observe(back);
  bare.observe(label);
}

// Reselecting the current tab (spec §6.1): on the tab's root it scrolls to the top and focuses the
// h1; on a pushed page the link itself goes to the root. A Ctrl/Cmd, Shift or Alt click is the
// browser's: a new tab or window (CO2-13). Diagnose keeps results/search state on its own root
// (`?q=`), so it hears `reselect` and pops that state too.
document.querySelector<HTMLElement>('nav.shell')?.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a =
    e.target instanceof Element
      ? e.target.closest<HTMLAnchorElement>('a.tab[aria-current="page"]')
      : null;
  if (!a || norm(location.pathname) !== norm(new URL(a.href).pathname)) return;
  e.preventDefault();
  window.scrollTo({ top: 0 });
  const h1 = document.querySelector('h1');
  if (h1) {
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  }
  emit('reselect');
});
