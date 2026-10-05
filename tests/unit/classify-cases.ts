import type { Transition, Visit } from '~/lib/nav-state';

/** A moment, and a record written half a second before it. */
export const NOW = 1_700_000_000_000;
export const visit = (v: Partial<Visit>): Visit => ({
  url: '/tables',
  tab: 'tables',
  depth: 0,
  label: 'Tables',
  at: NOW - 500,
  ...v,
});

export interface ClassifyCase {
  name: string;
  prev: Visit | null;
  here: { tab: string; depth: number };
  traverse?: 'back' | 'forward';
  expect: Transition;
}

/**
 * The classifier's case table (spec §10), shared by nav-state.test.ts, which calls `classify`, and
 * inline.test.ts, which runs the shell's inlined pagereveal script against it (audit TT3-04).
 */
export const CLASSIFY_CASES: ClassifyCase[] = [
  {
    name: 'deeper inside a tab pushes',
    prev: visit({}),
    here: { tab: 'tables', depth: 2 },
    expect: 'push',
  },
  {
    name: 'shallower inside a tab pops',
    prev: visit({ depth: 2 }),
    here: { tab: 'tables', depth: 1 },
    expect: 'pop',
  },
  {
    name: 'the same depth in a tab fades',
    prev: visit({ depth: 1 }),
    here: { tab: 'tables', depth: 1 },
    expect: 'fade',
  },
  {
    name: 'a tab-bar tap cross-fades, from a depth',
    prev: visit({ depth: 2, viaTab: true }),
    here: { tab: 'map', depth: 0 },
    expect: 'tab',
  },
  {
    name: 'a tab-bar tap cross-fades, to a depth',
    prev: visit({ viaTab: true }),
    here: { tab: 'handbook', depth: 2 },
    expect: 'tab',
  },
  {
    name: 'a view opened from another tab pushes',
    prev: visit({ url: '/?q=32', tab: 'diagnose', label: 'Results' }),
    here: { tab: 'tables', depth: 2 },
    expect: 'push',
  },
  {
    name: 'back to the other tab pops',
    prev: visit({ depth: 2 }),
    here: { tab: 'diagnose', depth: 0 },
    expect: 'pop',
  },
  {
    name: 'a traversal back pops',
    prev: visit({}),
    here: { tab: 'tables', depth: 2 },
    traverse: 'back',
    expect: 'pop',
  },
  {
    name: 'a traversal forward pushes',
    prev: visit({ depth: 2 }),
    here: { tab: 'tables', depth: 0 },
    traverse: 'forward',
    expect: 'push',
  },
  { name: 'no record fades', prev: null, here: { tab: 'tables', depth: 1 }, expect: 'fade' },
  {
    name: 'a swipe only fades',
    prev: visit({ depth: 2, swipe: true, back: true }),
    here: { tab: 'tables', depth: 1 },
    expect: 'fade',
  },
  {
    name: 'a swipe only fades, even when it traversed',
    prev: visit({ depth: 2, swipe: true, back: true }),
    here: { tab: 'tables', depth: 1 },
    traverse: 'back',
    expect: 'fade',
  },
  {
    name: 'a header back that replaced pops, whatever the depths',
    prev: visit({ depth: 1, back: true, replace: true }),
    here: { tab: 'tables', depth: 2 },
    expect: 'pop',
  },
  {
    name: 'a stale record counts as none',
    prev: visit({ at: NOW - 60_000 }),
    here: { tab: 'tables', depth: 2 },
    expect: 'fade',
  },
  {
    name: 'a record without a time counts as none',
    prev: { url: '/tables', tab: 'tables', depth: 0, label: 'Tables' },
    here: { tab: 'tables', depth: 2 },
    expect: 'fade',
  },
];
