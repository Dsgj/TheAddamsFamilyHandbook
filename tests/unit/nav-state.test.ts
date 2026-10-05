import { describe, expect, it } from 'vitest';
import { CLASSIFY_CASES, NOW, visit } from './classify-cases';
import {
  backAction,
  backOverride,
  classify,
  depthOf,
  fresh,
  previousUrl,
  readEntry,
  readState,
  resolveBack,
  sameUrl,
  swipeCommits,
  withEntry,
  writeState,
  type Here,
  type Load,
  type Visit,
} from '~/lib/nav-state';

const here = (h: Partial<Here>): Here => ({
  tab: 'tables',
  depth: 2,
  url: '/switch/32',
  staticHref: '/switches',
  ...h,
});
const load: Load = {
  now: NOW,
  referrer: 'http://app.test/',
  origin: 'http://app.test',
  histLen: 3,
};

describe('classify', () => {
  // The table is classify-cases.ts, which inline.test.ts runs the shipped script against too.
  it.each(CLASSIFY_CASES)('$name', ({ prev, here, traverse, expect: want }) => {
    expect(classify(prev, here, traverse, NOW)).toBe(want);
  });
  it('counts a record as fresh for 10 s, never from the future', () => {
    expect(fresh(visit({ at: NOW + 5 }), NOW)).toBe(false);
    expect(fresh(visit({ at: NOW - 10_000 }), NOW)).toBe(true);
  });
});

describe('backOverride', () => {
  const results = visit({ url: '/?q=32', tab: 'diagnose', label: 'Results' });
  it('points a cross-tab push back at its origin', () => {
    expect(backOverride(results, here({}), load)).toEqual({ href: '/?q=32', label: 'Results' });
    const verify = visit({ url: '/verify', tab: 'workshop', depth: 1, label: 'Verify' });
    expect(backOverride(verify, here({ url: '/switch/F1' }), load)).toEqual({
      href: '/verify',
      label: 'Verify',
    });
  });
  it('points a push down within a tab at its origin when that is not the parent', () => {
    const section = visit({
      url: '/handbook/tests',
      tab: 'handbook',
      depth: 1,
      label: 'Test menu',
    });
    const scan = here({ tab: 'handbook', url: '/manual/ops/25', staticHref: '/manual' });
    expect(backOverride(section, scan, load)).toEqual({
      href: '/handbook/tests',
      label: 'Test menu',
    });
    const manuals = visit({ url: '/manual', tab: 'handbook', depth: 1, label: 'Manuals' });
    expect(backOverride(manuals, scan, load)).toBeNull();
    expect(backOverride(visit({ url: '/switches', depth: 1 }), here({}), load)).toBeNull();
  });
  it('lets a page reached by paging inherit the back link of the page it replaced', () => {
    const page25 = visit({
      url: '/manual/ops/25',
      tab: 'handbook',
      depth: 2,
      label: 'p. 1-15',
      backLink: { href: '/handbook/tests', label: 'Test menu' },
    });
    const paged: Visit = { ...page25, replace: true };
    const next = here({ tab: 'handbook', url: '/manual/ops/26', staticHref: '/manual' });
    expect(backOverride(paged, next, load)).toEqual({
      href: '/handbook/tests',
      label: 'Test menu',
    });
    expect(backOverride(page25, next, load)).toBeNull();
  });
  it('keeps the static parent after a tab tap, a swipe, a back, a stale record or no referrer', () => {
    expect(backOverride(visit({ url: '/switch/31', depth: 2 }), here({}), load)).toBeNull();
    expect(backOverride({ ...results, viaTab: true }, here({}), load)).toBeNull();
    expect(backOverride({ ...results, swipe: true }, here({}), load)).toBeNull();
    expect(backOverride({ ...results, back: true }, here({}), load)).toBeNull();
    expect(backOverride({ ...results, at: NOW - 20_000 }, here({}), load)).toBeNull();
    expect(backOverride(results, here({ url: '/?q=32' }), load)).toBeNull();
    expect(backOverride(visit({ tab: '' }), here({}), load)).toBeNull();
    expect(backOverride(results, here({}), { ...load, referrer: '' })).toBeNull();
    expect(backOverride(results, here({}), { ...load, referrer: 'https://else.test/' })).toBeNull();
  });
});

describe('resolveBack', () => {
  const results = visit({ url: '/?q=32', tab: 'diagnose', label: 'Results' });
  const stored = { back: { href: '/?q=68', label: 'Results' } };
  it('keeps the stored record whatever the navigation type', () => {
    for (const navType of ['push', 'replace', 'reload', 'traverse', 'navigate', 'back_forward']) {
      expect(resolveBack({ stored, navType, prev: results, cur: here({}), load })).toEqual({
        link: stored.back,
        entry: null,
      });
    }
    const none = { back: null };
    expect(
      resolveBack({ stored: none, navType: 'push', prev: results, cur: here({}), load }),
    ).toEqual({ link: null, entry: null });
  });
  it('gives a traversal or a reload without a record the static parent, never the override', () => {
    for (const navType of ['traverse', 'back_forward', 'reload']) {
      expect(resolveBack({ stored: null, navType, prev: results, cur: here({}), load })).toEqual({
        link: null,
        entry: null,
      });
    }
  });
  it('decides a push and stamps it, with the previous entry for browsers without the API', () => {
    const r = resolveBack({
      stored: null,
      navType: 'push',
      prev: results,
      cur: here({}),
      load: { ...load, referrer: 'http://app.test/?q=32#x' },
    });
    expect(r.link).toEqual({ href: '/?q=32', label: 'Results' });
    expect(r.entry).toEqual({ back: r.link, from: '/?q=32' });
    const typed = resolveBack({
      stored: null,
      navType: 'push',
      prev: results,
      cur: here({}),
      load: { ...load, referrer: '' },
    });
    expect(typed).toEqual({ link: null, entry: { back: null } });
  });
  it('stamps no previous entry after a replace (its referrer is the page it replaced)', () => {
    const paged = visit({ url: '/manual/ops/25', tab: 'handbook', depth: 2, replace: true });
    const cur = here({ tab: 'handbook', url: '/manual/ops/26', staticHref: '/manual' });
    for (const navType of ['replace', 'navigate']) {
      const r = resolveBack({ stored: null, navType, prev: paged, cur, load });
      expect(r.entry?.from).toBeUndefined();
    }
  });
  it('carries the entry before the replaced page through a replace', () => {
    const paged = visit({
      url: '/manual/ops/25',
      tab: 'handbook',
      depth: 2,
      replace: true,
      from: '/handbook/tests',
    });
    const cur = here({ tab: 'handbook', url: '/manual/ops/26', staticHref: '/manual' });
    for (const navType of ['replace', 'navigate']) {
      const r = resolveBack({ stored: null, navType, prev: paged, cur, load });
      expect(r.entry?.from).toBe('/handbook/tests');
    }
    // A push is told apart by the Navigation API: the referrer is the entry before, not `from`.
    const push = resolveBack({
      stored: null,
      navType: 'push',
      prev: paged,
      cur,
      load: { ...load, referrer: 'http://app.test/manual/ops/25' },
    });
    expect(push.entry?.from).toBe('/manual/ops/25');
    // A stale record is not about this load.
    const stale = resolveBack({
      stored: null,
      navType: 'navigate',
      prev: { ...paged, at: NOW - 60_000 },
      cur,
      load: { ...load, referrer: '' },
    });
    expect(stale.entry?.from).toBeUndefined();
  });
  it('stamps no previous entry in a new tab, though its referrer is the page that opened it', () => {
    for (const navType of ['push', 'navigate']) {
      const r = resolveBack({
        stored: null,
        navType,
        prev: null,
        cur: here({}),
        load: { ...load, referrer: 'http://app.test/switches', histLen: 1 },
      });
      expect(r.entry).toEqual({ back: null });
    }
  });
});

describe('sameUrl', () => {
  it('compares the normalised path and the decoded query in any order', () => {
    expect(sameUrl('/valvet/', '/valvet')).toBe(true);
    expect(sameUrl('/switches.html', '/switches')).toBe(true);
    expect(sameUrl('/index.html', '/')).toBe(true);
    expect(sameUrl('/?q=32%2068', '/?q=32+68')).toBe(true);
    expect(sameUrl('/map?layer=sw,lamp&id=32', '/map?id=32&layer=sw%2Clamp')).toBe(true);
    expect(sameUrl('http://app.test/switches#x', '/switches')).toBe(true);
    expect(sameUrl('/?q=32', '/?q=68')).toBe(false);
    expect(sameUrl('/switches', '/lamps')).toBe(false);
    expect(sameUrl(null, '/')).toBe(false);
  });
});

describe('previousUrl and backAction', () => {
  const nav = (index: number, urls: string[]) => ({
    currentEntry: { index },
    entries: () => urls.map((url) => ({ url })),
  });
  it('reads the entry before this one from the Navigation API', () => {
    expect(previousUrl(nav(0, ['http://app.test/switch/32']), null, 1)).toBeNull();
    expect(
      previousUrl(nav(1, ['http://app.test/switches', 'http://app.test/switch/32']), null, 2),
    ).toBe('http://app.test/switches');
  });
  it('falls back to the stamped previous entry, else none', () => {
    const state = withEntry({ other: 1 }, { back: null, from: '/switches' });
    expect(state).toEqual({ other: 1, tafh: { back: null, from: '/switches' } });
    expect(previousUrl(undefined, state, 2)).toBe('/switches');
    expect(previousUrl({ currentEntry: null, entries: () => [] }, state, 2)).toBe('/switches');
    expect(previousUrl(undefined, null, 2)).toBeNull();
    expect(readEntry({ tafh: { back: { href: 1 } } })).toEqual({ back: null });
  });
  it('finds none in a tab whose history holds one entry, whatever the entry says', () => {
    const state = withEntry(null, { back: null, from: '/switches' });
    expect(previousUrl(undefined, state, 1)).toBeNull();
    expect(backAction('/switches', previousUrl(undefined, state, 1))).toBe('replace');
  });
  it('traverses only when the previous entry is the target', () => {
    expect(backAction('http://app.test/switches', 'http://app.test/switches')).toBe('traverse');
    expect(backAction('/?q=32%2068', 'http://app.test/?q=32+68')).toBe('traverse');
    expect(backAction('/tables', '/switches')).toBe('replace');
    expect(backAction('/tables', null)).toBe('replace');
  });
});

describe('depthOf', () => {
  const tabs = ['', 'map', 'tables', 'handbook', 'workshop'];
  it('is 1 under a tab root and 2 below that', () => {
    expect(depthOf(undefined, tabs)).toBe(0);
    expect(depthOf('handbook', tabs)).toBe(1); // a Handbook section, and Manuals
    expect(depthOf('', tabs)).toBe(1); // 404, under Diagnose
    expect(depthOf('manual', tabs)).toBe(2); // a manual page
    expect(depthOf('switches', tabs)).toBe(2);
  });
});

describe('state storage', () => {
  it('round-trips and survives garbage', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    writeState(storage, { tabs: { map: '/map?z=1.6' }, scroll: { '/switch/32': 240 } });
    expect(readState(storage)).toEqual({
      tabs: { map: '/map?z=1.6' },
      scroll: { '/switch/32': 240 },
    });
    mem.set('tafh:nav', '{not json');
    expect(readState(storage)).toEqual({ tabs: {}, scroll: {} });
  });
});

describe('swipeCommits', () => {
  it('commits past 35% of the width or above 500 px/s', () => {
    expect(swipeCommits(140, 400, 0)).toBe(true);
    expect(swipeCommits(139, 400, 499)).toBe(false);
    expect(swipeCommits(40, 400, 500)).toBe(true);
  });
});
