import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A Map-backed Storage with switchable failures. */
class FakeStorage {
  map = new Map<string, string>();
  failGet = false;
  failSet = false;
  getItem(k: string) {
    if (this.failGet) throw new Error('SecurityError');
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.failSet) throw new DOMException('full', 'QuotaExceededError');
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

let store: FakeStorage;
let win: EventTarget;
let doc: EventTarget & { visibilityState: string };

const load = async () => {
  vi.resetModules();
  return import('~/lib/storage');
};
const parse = (k: string) => JSON.parse(store.map.get(k) ?? 'null') as unknown;
const fire = (target: EventTarget, type: string, fields: object = {}) =>
  target.dispatchEvent(Object.assign(new Event(type), fields));
/** Lets a promise chain of a few steps finish. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
  store = new FakeStorage();
  win = new EventTarget();
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('localStorage', store);
  vi.stubGlobal('navigator', {});
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('read-modify-write', () => {
  it('keeps an entry another tab wrote after this page loaded', async () => {
    const s = await load();
    expect(s.readEntries('tafh:status')).toEqual({});
    store.setItem('tafh:status', JSON.stringify({ 'switch:32': 1 }));
    s.updateEntry<number>('tafh:status', 'lamp:55', () => 2);
    expect(parse('tafh:status')).toEqual({ 'switch:32': 1, 'lamp:55': 2 });
  });

  it('deletes the entry when the fn returns undefined', async () => {
    const s = await load();
    store.setItem('k', JSON.stringify({ a: 1, b: 2 }));
    expect(s.updateEntry('k', 'a', () => undefined)).toEqual({ b: 2 });
    expect(parse('k')).toEqual({ b: 2 });
  });

  it('reads the legacy key until the first write, and {} shadows it', async () => {
    const s = await load();
    store.setItem('valvet:status', JSON.stringify({ a: 1 }));
    expect(s.readEntries('tafh:status', 'valvet:status')).toEqual({ a: 1 });
    s.updateEntry<number>('tafh:status', 'b', () => 2, 'valvet:status');
    expect(parse('tafh:status')).toEqual({ a: 1, b: 2 });
    expect(parse('valvet:status')).toEqual({ a: 1 });
    s.writeJson('tafh:status', {});
    expect(s.readEntries('tafh:status', 'valvet:status')).toEqual({});
    expect(parse('valvet:status')).toEqual({ a: 1 });
  });

  it('falls back on junk: unparsable, an array for entries, an object for a list', async () => {
    const s = await load();
    store.map.set('a', '{nope');
    store.map.set('b', '[1,2]');
    store.map.set('c', '{"x":1}');
    expect(s.readEntries('a')).toEqual({});
    expect(s.readEntries('b')).toEqual({});
    expect(s.readList('c', 8)).toEqual([]);
    store.map.set('d', JSON.stringify([1, 2, 3, 4]));
    expect(s.readList('d', 2)).toEqual([1, 2]);
  });

  it('updateJson rewrites a list from its fresh value', async () => {
    const s = await load();
    store.setItem('tafh:recent', JSON.stringify(['theirs']));
    s.updateJson<string[]>('tafh:recent', [], (cur) => ['mine', ...cur]);
    expect(parse('tafh:recent')).toEqual(['mine', 'theirs']);
  });
});

describe('deferred writes', () => {
  it('write after 400 ms of quiet, and a later call restarts the wait', async () => {
    const s = await load();
    s.deferEntry<string>('k', 'x', () => 'one');
    vi.advanceTimersByTime(399);
    expect(store.map.has('k')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(parse('k')).toEqual({ x: 'one' });

    s.deferEntry<string>('k', 'y', () => 'one');
    vi.advanceTimersByTime(300);
    s.deferEntry<string>('k', 'y', () => 'two');
    vi.advanceTimersByTime(399);
    expect(parse('k')).toEqual({ x: 'one' });
    vi.advanceTimersByTime(1);
    expect(parse('k')).toEqual({ x: 'one', y: 'two' });
  });

  it('flush on pagehide and when the page is hidden, and compose in call order', async () => {
    const s = await load();
    const set = vi.spyOn(store, 'setItem');
    s.deferEntry<string>('k', 'x', () => 'a');
    s.deferEntry<string>('k', 'x', (cur) => `${cur}b`);
    fire(win, 'pagehide');
    expect(parse('k')).toEqual({ x: 'ab' });

    s.deferEntry<string>('k', 'x', () => 'c');
    doc.visibilityState = 'hidden';
    fire(doc, 'visibilitychange');
    expect(parse('k')).toEqual({ x: 'c' });

    vi.advanceTimersByTime(1000);
    expect(set).toHaveBeenCalledTimes(2);
  });

  it('run before an update of the same entry or another entry of the key', async () => {
    const s = await load();
    s.deferEntry<string>('k', 'x', () => 'typed');
    s.updateEntry<string>('k', 'x', (cur) => `${cur}!`);
    expect(parse('k')).toEqual({ x: 'typed!' });

    s.deferEntry<string>('k', 'x', () => 'more');
    s.updateEntry<string>('k', 'y', () => 'tap');
    expect(parse('k')).toEqual({ x: 'more', y: 'tap' });
    const set = vi.spyOn(store, 'setItem');
    vi.advanceTimersByTime(1000);
    expect(set).not.toHaveBeenCalled();
  });

  it('of other entries go along when one entry is written, so no watcher reverts them', async () => {
    const s = await load();
    const seen: unknown[] = [];
    s.watch('k', () => seen.push(s.readEntries('k')));
    s.deferEntry<string>('k', 'x', () => 'a');
    vi.advanceTimersByTime(300);
    s.deferEntry<string>('k', 'y', () => 'hell');
    vi.advanceTimersByTime(100);
    expect(parse('k')).toEqual({ x: 'a', y: 'hell' });
    expect(seen).toEqual([{ x: 'a', y: 'hell' }]);

    s.deferEntry<string>('k', 'x', () => 'b');
    s.deferEntry<string>('k', 'y', () => 'hello');
    s.flush('k');
    expect(seen.at(-1)).toEqual({ x: 'b', y: 'hello' });
    const set = vi.spyOn(store, 'setItem');
    vi.advanceTimersByTime(1000);
    expect(set).not.toHaveBeenCalled();
  });

  it('are dropped by a whole-value write, which notifies', async () => {
    const s = await load();
    const cb = vi.fn();
    s.watch('k', cb);
    s.deferEntry<string>('k', 'x', () => 'late');
    s.writeJson('k', {});
    expect(cb).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    fire(win, 'pagehide');
    expect(parse('k')).toEqual({});
  });

  it('computes from the entry at flush time', async () => {
    const s = await load();
    s.deferEntry<{ status: string; note: string }>('k', 'x', (cur) => ({
      status: cur?.status ?? '',
      note: 'typed',
    }));
    store.setItem('k', JSON.stringify({ x: { status: 'fault', note: '' } }));
    s.flush();
    expect(parse('k')).toEqual({ x: { status: 'fault', note: 'typed' } });
  });
});

describe('watchers', () => {
  it('follow storage events for their key, all keys on a clear, never another area', async () => {
    const s = await load();
    const a = vi.fn();
    const b = vi.fn();
    s.watch('a', a);
    s.watch('b', b);
    fire(win, 'storage', { key: 'a', storageArea: store });
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 0]);
    fire(win, 'storage', { key: null, storageArea: store });
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([2, 1]);
    fire(win, 'storage', { key: 'a', storageArea: {} });
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([2, 1]);
  });

  it('run on pageshow only from the back/forward cache, and when the page shows again', async () => {
    const s = await load();
    const a = vi.fn();
    s.watch('a', a);
    fire(win, 'pageshow', { persisted: false });
    expect(a).not.toHaveBeenCalled();
    fire(win, 'pageshow', { persisted: true });
    expect(a).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'visible';
    fire(doc, 'visibilitychange');
    expect(a).toHaveBeenCalledTimes(2);
  });

  it('see local edits first on a resync, so typing is never reverted', async () => {
    const s = await load();
    const seen: unknown[] = [];
    s.watch('a', () => seen.push(s.readEntries('a')));
    s.deferEntry<string>('a', 'x', () => 'mine');
    store.setItem('a', JSON.stringify({ y: 'theirs' }));
    fire(win, 'storage', { key: 'a', storageArea: store });
    expect(parse('a')).toEqual({ x: 'mine', y: 'theirs' });
    expect(seen.at(-1)).toEqual({ x: 'mine', y: 'theirs' });
  });

  it('are told about an unchanged write, which is not written again', async () => {
    const s = await load();
    const cb = vi.fn();
    s.watch('k', cb);
    const set = vi.spyOn(store, 'setItem');
    s.writeJson('k', { a: 1 });
    s.writeJson('k', { a: 1 });
    s.updateEntry<number>('k', 'a', () => 1);
    expect(set).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('can be removed', async () => {
    const s = await load();
    const cb = vi.fn();
    const off = s.watch('k', cb);
    off();
    s.writeJson('k', 1);
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("another tab's Clear", () => {
  it('drops the edits this page queued before it, and keeps the ones after', async () => {
    const s = await load();
    s.deferEntry<string>('tafh:status', 'x', () => 'typed before');
    vi.advanceTimersByTime(50);
    // The other tab stamps the key first, then writes the value (writeJson with reset).
    store.setItem('tafh:reset', JSON.stringify({ 'tafh:status': 1 }));
    store.setItem('tafh:status', '{}');
    fire(win, 'storage', { key: 'tafh:reset', storageArea: store });
    fire(win, 'storage', { key: 'tafh:status', storageArea: store });
    expect(parse('tafh:status')).toEqual({});
    vi.advanceTimersByTime(50);
    s.deferEntry<string>('tafh:status', 'y', () => 'typed after');
    s.flush();
    expect(parse('tafh:status')).toEqual({ y: 'typed after' });
  });

  it('is told apart from the other tab removing its last entry, which keeps the edit', async () => {
    const s = await load();
    store.setItem('tafh:status', JSON.stringify({ y: 'theirs' }));
    s.deferEntry<string>('tafh:status', 'x', () => 'mine');
    vi.advanceTimersByTime(50);
    store.setItem('tafh:status', '{}');
    fire(win, 'storage', { key: 'tafh:status', storageArea: store });
    expect(parse('tafh:status')).toEqual({ x: 'mine' });
  });

  it('is stamped only by a write with reset (Clear, replace), not by a merge write', async () => {
    const s = await load();
    s.writeJson('tafh:setup', { a: 1 });
    expect(parse('tafh:reset')).toBeNull();
    s.writeJson('tafh:setup', {}, { reset: true });
    expect(parse('tafh:reset')).toEqual({ 'tafh:setup': 1 });
    expect(parse('tafh:setup')).toEqual({});
    s.writeJson('tafh:setup', {}, { reset: true });
    expect(parse('tafh:reset')).toEqual({ 'tafh:setup': 2 });
  });

  // The stamp is a count, not a time: after the clock goes back (a manual change, a network time
  // fix), an edit made after the Clear still has to be kept.
  it('keeps an edit typed after a Clear when the clock has gone back since', async () => {
    vi.setSystemTime(new Date('2026-09-29T12:00:00Z'));
    const s = await load();
    s.writeJson('tafh:status', {}, { reset: true });
    vi.setSystemTime(new Date('2026-09-29T11:00:00Z'));
    s.deferEntry<string>('tafh:status', 'switch:32', () => 'typed after clear');
    vi.advanceTimersByTime(500);
    expect(parse('tafh:status')).toEqual({ 'switch:32': 'typed after clear' });
  });

  it('keeps that edit when a tap flushes it, after the clock went back a minute', async () => {
    vi.setSystemTime(new Date('2026-09-29T12:00:00Z'));
    const s = await load();
    s.writeJson('tafh:status', {}, { reset: true });
    vi.setSystemTime(new Date('2026-09-29T11:59:00Z'));
    s.deferEntry<string>('tafh:status', 'switch:32', () => 'note');
    s.updateEntry<string>('tafh:status', 'lamp:55', () => 'ok');
    expect(parse('tafh:status')).toEqual({ 'switch:32': 'note', 'lamp:55': 'ok' });
  });
});

describe('when storage fails', () => {
  it('a read that throws gives the fallback', async () => {
    const s = await load();
    store.map.set('k', '{"a":1}');
    store.failGet = true;
    expect(s.readEntries('k')).toEqual({});
  });

  it('a refused write stays readable from memory, and older data stays readable', async () => {
    const s = await load();
    store.setItem('k', JSON.stringify({ old: 1 }));
    store.failSet = true;
    expect(s.readEntries('k')).toEqual({ old: 1 });
    expect(() => s.updateEntry<number>('k', 'new', () => 2)).not.toThrow();
    expect(s.readEntries('k')).toEqual({ old: 1, new: 2 });
    expect(s.writeJson('k', { a: 1 })).toBe(false);
    expect(s.readEntries('k')).toEqual({ a: 1 });
    store.failSet = false;
    expect(s.writeJson('k', { b: 1 })).toBe(true);
    expect(parse('k')).toEqual({ b: 1 });
  });

  it('a refused write gives way once another tab writes the key or clears storage', async () => {
    const s = await load();
    s.watch('k', () => {});
    store.failSet = true;
    s.updateEntry<number>('k', 'mine', () => 1);
    expect(s.readEntries('k')).toEqual({ mine: 1 });
    store.failSet = false;
    store.setItem('k', JSON.stringify({ theirs: 2 }));
    fire(win, 'storage', { key: 'k', storageArea: store });
    expect(s.readEntries('k')).toEqual({ theirs: 2 });
    store.failSet = true;
    s.updateEntry<number>('k', 'mine', () => 1);
    expect(s.readEntries('k')).toEqual({ theirs: 2, mine: 1 });
    store.failSet = false;
    store.map.clear();
    fire(win, 'storage', { key: null, storageArea: store });
    expect(s.readEntries('k')).toEqual({});
  });

  it('without a window, reads fall back and writes and watch do nothing', async () => {
    vi.stubGlobal('window', undefined);
    const s = await load();
    store.map.set('k', '{"a":1}');
    expect(s.readEntries('k')).toEqual({});
    expect(s.readList('k', 8)).toEqual([]);
    expect(() => s.writeJson('k', { b: 1 })).not.toThrow();
    expect(() => s.deferEntry('k', 'x', () => 1)).not.toThrow();
    expect(() => s.updateEntry('k', 'x', () => 1)).not.toThrow();
    expect(s.watch('k', () => {})).toBeTypeOf('function');
    vi.advanceTimersByTime(1000);
    expect(parse('k')).toEqual({ a: 1 });
  });
});

describe('requestPersist', () => {
  const stubStorage = (persisted: boolean) => {
    const api = {
      persisted: vi.fn(() => Promise.resolve(persisted)),
      persist: vi.fn(() => Promise.resolve(true)),
    };
    vi.stubGlobal('navigator', { storage: api });
    return api;
  };

  it('asks once, on the first write of backup data and not on load', async () => {
    const api = stubStorage(false);
    const s = await load();
    s.readEntries('tafh:status');
    s.updateJson<string[]>('tafh:recent', [], () => ['x']);
    await settle();
    expect(api.persist).not.toHaveBeenCalled();
    s.updateEntry<number>('tafh:status', 'a', () => 1);
    s.updateEntry<number>('tafh:setup', 'b', () => 1);
    s.writeJson('tafh:verify', {});
    await settle();
    expect(api.persist).toHaveBeenCalledTimes(1);
  });

  it('skips persist when storage is already kept', async () => {
    const api = stubStorage(true);
    const s = await load();
    s.updateEntry<number>('tafh:status', 'a', () => 1);
    await settle();
    expect(api.persisted).toHaveBeenCalledTimes(1);
    expect(api.persist).not.toHaveBeenCalled();
  });

  it('is not asked by a timer or pagehide flush, only by the change handler after it', async () => {
    const api = stubStorage(false);
    const s = await load();
    s.deferEntry<string>('tafh:status', 'a', () => 'x');
    vi.advanceTimersByTime(400);
    s.deferEntry<string>('tafh:status', 'a', () => 'y');
    fire(win, 'pagehide');
    await settle();
    expect(parse('tafh:status')).toEqual({ a: 'y' });
    expect(api.persist).not.toHaveBeenCalled();
    s.requestPersist();
    await settle();
    expect(api.persist).toHaveBeenCalledTimes(1);
  });

  it('is safe without navigator.storage', async () => {
    const s = await load();
    expect(() => s.updateEntry<number>('tafh:status', 'a', () => 1)).not.toThrow();
    await settle();
    vi.stubGlobal('navigator', undefined);
    expect(() => s.requestPersist()).not.toThrow();
  });
});

describe('syncEntries', () => {
  it('assigns only what differs and deletes what is gone', async () => {
    const s = await load();
    const same = { v: 1 };
    const target: Record<string, { v: number }> = { same, changed: { v: 1 }, gone: { v: 1 } };
    s.syncEntries(target, { same: { v: 1 }, changed: { v: 2 }, added: { v: 3 } });
    expect(target).toEqual({ same: { v: 1 }, changed: { v: 2 }, added: { v: 3 } });
    expect(target.same).toBe(same);
  });
});
