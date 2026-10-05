import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryState, queryString } from '~/lib/query-state';

/** A page at `url` with a Diagnose field: the machine sees its address and writes it in place. */
function page(url: string) {
  const at = new URL(url, 'https://x.test');
  const writes: string[] = [];
  let field = '';
  const state = createQueryState({
    query: () => field.trim(),
    replace: (next) => {
      writes.push(next);
      const u = new URL(next, 'https://x.test');
      at.pathname = u.pathname;
      at.search = u.search;
      at.hash = u.hash;
    },
    location: () => ({ pathname: at.pathname, search: at.search, hash: at.hash }),
  });
  return {
    state,
    writes,
    /** Types `s` into the field; returns the `?q=` the entry names. */
    type: (s: string) => {
      field = s;
      return state.changed();
    },
    fill: (s: string) => (field = s),
    address: () => at.pathname + at.search + at.hash,
  };
}

describe('query-state (AR3-07)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('queryString is exactly ?q= plus encodeURIComponent, or nothing', () => {
    expect(queryString('')).toBe('');
    expect(queryString('32')).toBe('?q=32');
    expect(queryString('flipper lane')).toBe('?q=flipper%20lane');
    expect(queryString('F1 & F3')).toBe('?q=F1%20%26%20F3');
  });

  it('a loaded ?q= fills the field, is committed and is normalised to the one form', () => {
    const p = page('/?q=%33%32');
    let loaded = '';
    p.state.start((q) => {
      loaded = q;
      p.fill(q);
    });
    expect(loaded).toBe('32');
    expect(p.writes).toEqual(['/?q=32']);
    // Emptying the field returns to the clean home at once.
    expect(p.type('')).toBe('');
    expect(p.address()).toBe('/');
  });

  it('an already normalised ?q= and its hash are left as they are', () => {
    const p = page('/valvet/?q=32#top');
    p.state.start((q) => p.fill(q));
    expect(p.writes).toEqual([]);
    p.type('33');
    vi.advanceTimersByTime(250);
    expect(p.address()).toBe('/valvet/?q=33#top');
  });

  it('an empty ?q= is stripped on load and the field stays empty', () => {
    const p = page('/?q=');
    const onLoad = vi.fn();
    p.state.start(onLoad);
    expect(onLoad).not.toHaveBeenCalled();
    expect(p.writes).toEqual(['/']);
  });

  it('typing before a commit leaves the address alone, but names the entry', () => {
    const p = page('/');
    p.state.start(() => {});
    expect(p.type('32')).toBe('?q=32');
    vi.advanceTimersByTime(5000);
    expect(p.writes).toEqual([]);
  });

  it('commit writes at once, and not for an empty field', () => {
    const p = page('/');
    p.state.start(() => {});
    p.state.commit();
    expect(p.writes).toEqual([]);
    p.type('32');
    p.state.commit();
    expect(p.writes).toEqual(['/?q=32']);
  });

  it('edits after a commit are written once per pause', () => {
    const p = page('/');
    p.state.start(() => {});
    p.type('3');
    p.state.commit();
    p.type('32');
    p.type('32 6');
    p.type('32 68 ');
    vi.advanceTimersByTime(249);
    expect(p.writes).toEqual(['/?q=3']);
    vi.advanceTimersByTime(1);
    expect(p.writes).toEqual(['/?q=3', '/?q=32%2068']);
  });

  it('emptying a committed field returns to the clean home at once and uncommits', () => {
    const p = page('/');
    p.state.start(() => {});
    p.type('32');
    p.state.commit();
    p.type('');
    expect(p.address()).toBe('/');
    p.type('7');
    vi.advanceTimersByTime(1000);
    expect(p.writes).toEqual(['/?q=32', '/']);
  });

  it('uncommit clears the address and stops following the field', () => {
    const p = page('/');
    p.state.start(() => {});
    p.type('32');
    p.state.commit();
    p.state.uncommit();
    expect(p.address()).toBe('/');
    p.type('33');
    vi.advanceTimersByTime(1000);
    expect(p.writes).toEqual(['/?q=32', '/']);
  });

  it('flush writes a waiting edit now, and nothing when none waits', () => {
    const p = page('/');
    p.state.start(() => {});
    p.type('3');
    p.state.commit();
    p.type('32');
    p.state.flush();
    expect(p.address()).toBe('/?q=32');
    p.state.flush();
    vi.advanceTimersByTime(1000);
    expect(p.writes).toEqual(['/?q=3', '/?q=32']);
  });

  it('frozen in the back/forward cache, the write waits for the thaw', () => {
    const p = page('/');
    p.state.start(() => {});
    p.type('3');
    p.state.commit();
    p.type('32');
    p.state.freeze(true);
    p.state.flush();
    expect(p.address()).toBe('/?q=3');
    p.state.freeze(false);
    expect(p.address()).toBe('/?q=32');
  });

  it('dispose drops a waiting edit', () => {
    const p = page('/');
    p.state.start(() => {});
    p.type('3');
    p.state.commit();
    p.type('32');
    p.state.dispose();
    vi.advanceTimersByTime(1000);
    expect(p.writes).toEqual(['/?q=3']);
  });
});
