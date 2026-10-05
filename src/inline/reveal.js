// @ts-check
/*
 * The view transition's type (spec §10): push, pop, tab or fade, from `classify` (classify.js,
 * inlined just above this file by Base.astro) given the page being left (motion.ts writes the
 * `tafh:prev` record on pagehide) and the history direction. It must run before the first render,
 * so it is inline; the rest of the continuity is motion.ts. The record's key is the script tag's
 * data-prev. Under Playwright (navigator.webdriver) it also leaves `window.tafhMotion`, what ran,
 * for the tests (SV2-13). The import below goes when the two files are inlined as one script.
 */
import { classify } from './classify.js';

/**
 * @typedef {{ name: string; duration: number; props: string[] }} Ran
 * @typedef {{ type: string; animations: Ran[]; pending?: true; skipped?: true }} Probe
 * @typedef {{ index: number }} Entry
 * @typedef {{ navigationType: string; from: Entry | null }} Activation
 * @typedef {{ currentEntry: Entry | null; activation: Activation | null }} NavApi
 */

const ds = /** @type {{ prev: string }} */ (document.currentScript?.dataset || {});
const win = /** @type {Window & { tafhMotion?: Probe; navigation?: NavApi }} */ (window);

addEventListener('pagereveal', (e) => {
  const vt = e.viewTransition;
  const probe = navigator.webdriver;
  if (!vt) {
    if (probe) win.tafhMotion = { type: 'none', animations: [] };
    return;
  }
  /** @type {import('../lib/nav-state').Visit | null} */
  let prev = null;
  try {
    prev = JSON.parse(sessionStorage.getItem(ds.prev) || 'null');
  } catch {
    /* no storage: no record */
  }
  const d = document.documentElement.dataset;
  // Truthiness, not just `in`: a browser (or a test) may define `navigation` without the API.
  const nav = win.navigation;
  const act = nav && nav.currentEntry ? nav.activation : null;
  const from = act && act.navigationType === 'traverse' ? act.from : null;
  const traverse =
    from && nav && nav.currentEntry
      ? from.index > nav.currentEntry.index
        ? 'back'
        : 'forward'
      : undefined;
  const type = classify(prev, { tab: d.tab || '', depth: Number(d.depth || 0) }, traverse);
  vt.types.add(type);
  if (!probe) return;
  // What ran: only the clock's animations, since a scroller's edge fade runs on its scroll
  // timeline and has no duration (VP2-04).
  win.tafhMotion = { type, animations: [], pending: true };
  const ran = () => {
    win.tafhMotion = {
      type,
      animations: document
        .getAnimations()
        .filter((a) => a.timeline === document.timeline)
        .map((a) => {
          const fx = /** @type {KeyframeEffect | null} */ (a.effect);
          /** @type {Record<string, true>} */
          const props = {};
          for (const k of fx ? fx.getKeyframes() : [])
            for (const p of Object.keys(k))
              if (!/^(offset|computedOffset|easing|composite)$/.test(p)) props[p] = true;
          const css = /** @type {Partial<CSSAnimation & CSSTransition>} */ (a);
          return {
            name: css.animationName || css.transitionProperty || a.id || '',
            duration: fx ? Number(fx.getTiming().duration) : 0,
            props: Object.keys(props).sort(),
          };
        }),
    };
  };
  // One chain with both handlers: a `.then` beside a `.catch` leaves its own promise rejected,
  // unhandled, whenever the browser aborts the transition.
  vt.ready.then(ran, () => {
    win.tafhMotion = { type, animations: [], skipped: true };
  });
});
