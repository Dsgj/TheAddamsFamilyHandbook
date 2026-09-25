import { describe, expect, it } from 'vitest';
import {
  backOverride,
  classify,
  readState,
  swipeCommits,
  writeState,
  type Visit,
} from '~/lib/nav-state';

const visit = (v: Partial<Visit>): Visit => ({
  url: '/tables',
  tab: 'tables',
  depth: 0,
  label: 'Tables',
  ...v,
});

describe('classify', () => {
  it('follows depth inside a tab', () => {
    expect(classify(visit({}), { tab: 'tables', depth: 2 })).toBe('push');
    expect(classify(visit({ depth: 2 }), { tab: 'tables', depth: 1 })).toBe('pop');
    expect(classify(visit({ depth: 1 }), { tab: 'tables', depth: 1 })).toBe('fade');
  });
  it('cross-fades a tab-bar tap whatever the depths', () => {
    expect(classify(visit({ depth: 2, viaTab: true }), { tab: 'map', depth: 0 })).toBe('tab');
    expect(classify(visit({ viaTab: true }), { tab: 'handbook', depth: 2 })).toBe('tab');
  });
  it('pushes a view opened from another tab, and pops back to it', () => {
    const results = visit({ url: '/?q=32', tab: 'diagnose', label: 'Results' });
    expect(classify(results, { tab: 'tables', depth: 2 })).toBe('push');
    expect(classify(visit({ depth: 2 }), { tab: 'diagnose', depth: 0 })).toBe('pop');
  });
  it('lets a traversal decide by direction, and a swipe only fade', () => {
    expect(classify(visit({}), { tab: 'tables', depth: 2 }, 'back')).toBe('pop');
    expect(classify(visit({ depth: 2 }), { tab: 'tables', depth: 0 }, 'forward')).toBe('push');
    expect(classify(visit({ depth: 2, swipe: true }), { tab: 'tables', depth: 1 })).toBe('fade');
    expect(classify(null, { tab: 'tables', depth: 1 })).toBe('fade');
  });
});

describe('backOverride', () => {
  const results = visit({ url: '/?q=32', tab: 'diagnose', label: 'Results' });
  it('points a cross-tab push back at its origin', () => {
    expect(backOverride(results, { tab: 'tables', url: '/switch/32' })).toEqual({
      href: '/?q=32',
      label: 'Results',
    });
  });
  it('keeps the static parent inside a tab, after a tab tap, a swipe or a reload', () => {
    expect(backOverride(visit({}), { tab: 'tables', url: '/switch/32' })).toBeNull();
    expect(backOverride({ ...results, viaTab: true }, { tab: 'tables', url: '/x' })).toBeNull();
    expect(backOverride({ ...results, swipe: true }, { tab: 'tables', url: '/x' })).toBeNull();
    expect(backOverride(results, { tab: 'tables', url: '/?q=32' })).toBeNull();
    expect(backOverride(visit({ tab: '' }), { tab: 'tables', url: '/x' })).toBeNull();
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
