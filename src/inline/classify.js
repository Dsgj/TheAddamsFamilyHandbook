// @ts-check
/*
 * The view transition's type and the tab reselect's path rule (spec §10, §6.1), in plain JS with
 * no imports: Base.astro inlines this file (src/lib/inline-script.ts) ahead of reveal.js, so the
 * classifier that runs before the first paint is this one, and nav-state.ts re-exports the same
 * functions for motion.ts, shell.ts and the unit tests (audit AR3-01, TT3-04). tsc checks it
 * through the JSDoc types; tests/unit/inline.test.ts runs the inlined text.
 */

/** @typedef {'push' | 'pop' | 'tab' | 'fade'} Transition */
/** @typedef {import('../lib/nav-state').Visit} Visit */

/** A `tafh:prev` record older than this (ms) is not about the page now loading. */
export const FRESH_MS = 10000;

/**
 * The record is about the page now loading: written within the last FRESH_MS.
 * @param {Visit | null | undefined} prev
 * @param {number} now
 * @returns {prev is Visit}
 */
export function fresh(prev, now) {
  if (!prev || typeof prev.at !== 'number') return false;
  const age = now - prev.at;
  return age >= 0 && age <= FRESH_MS;
}

/**
 * The path rule the tab reselect compares by: no `.html`, no `/index`, no trailing slash.
 * @param {string} p
 */
export function norm(p) {
  return p
    .replace(/\.html$/, '')
    .replace(/\/index$/, '')
    .replace(/\/$/, '');
}

/**
 * Which animation the incoming page runs. A swipe back already moved the page, so it only fades;
 * a history traversal is decided by direction; a back that replaced pops; a tab-bar tap
 * cross-fades; otherwise depth decides. A `prev` that is not fresh counts as none.
 * @param {Visit | null} prev
 * @param {{ tab: string; depth: number }} cur
 * @param {'back' | 'forward' | undefined} [traverse]
 * @param {number} [now]
 * @returns {Transition}
 */
export function classify(prev, cur, traverse, now = Date.now()) {
  const p = fresh(prev, now) ? prev : null;
  if (p && p.swipe) return 'fade';
  if (traverse) return traverse === 'back' ? 'pop' : 'push';
  if (!p) return 'fade';
  if (p.back) return 'pop';
  if (p.viaTab) return 'tab';
  if (p.depth < cur.depth) return 'push';
  if (p.depth > cur.depth) return 'pop';
  return p.tab === cur.tab ? 'fade' : 'tab';
}
