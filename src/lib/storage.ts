/**
 * The one door to the device data in localStorage: the backup keys below, the Recent/Viewed
 * lists, Continue reading and the display preferences. Every key the app keeps is named here
 * (audit AR2-12, SV2-14): a structure rule keeps `tafh:` strings and localStorage out of other
 * modules, except the inline scripts that read a preference before the first paint, which get
 * their keys from here through `define:vars`. Plain TS (no runes), so vitest runs it in node; M2
 * can move the backend to IndexedDB behind the same functions.
 *
 * - Every write re-reads storage first and changes one entry (or one list), so a second tab or a
 *   page restored from the back/forward cache never writes an old snapshot over newer marks.
 * - Typed text is saved after a short pause and flushed on `pagehide` and when the page is
 *   hidden, so leaving a field with system Back keeps it.
 * - `watch()` tells the stores about their own writes and about outside changes (another tab's
 *   `storage` event, a bfcache restore, the page becoming visible again).
 * - When storage refuses a write (quota, blocked), the value is kept in memory for this page.
 * - Clear and import-replace count up the key in `tafh:reset`, so an edit another tab queued before
 *   that cannot bring a cleared entry back. A count, not a time: a clock set back must not drop
 *   edits made after the Clear.
 */

import { toast } from '~/lib/events';

type Entries<V> = Record<string, V>;
type Fn<V> = (cur: V | undefined) => V | undefined;

/** The keys that go into the backup file. A write to one of them asks to keep storage. */
export const BACKUP_KEYS = {
  status: 'tafh:status',
  setup: 'tafh:setup',
  verify: 'tafh:verify',
} as const;
const KEPT: ReadonlySet<string> = new Set(Object.values(BACKUP_KEYS));

/**
 * Where a key lived before the rename to `tafh:`. The status map is read from its old key while
 * the new one is absent and never writes it (Clear writes `{}`); a preference's old key is
 * removed when the preference is next written.
 */
export const LEGACY_KEYS = {
  status: 'valvet:status',
  theme: 'valvet:theme',
  fit: 'valvet:manual-fit',
} as const;

/**
 * The device's other keys, not backed up: Recent and Viewed and Continue reading. The map's
 * calibration draft (`?calib=1`) keeps its first name in MapCalibration, so the map's chunk does
 * not carry it (SV-08).
 */
export const KEYS = {
  recent: 'tafh:recent',
  viewed: 'tafh:viewed',
  reading: 'tafh:reading',
} as const;

/** The per-tab records in sessionStorage, which motion.ts writes and nav-state.ts reads. */
export const SESSION_KEYS = { prev: 'tafh:prev', nav: 'tafh:nav' } as const;

/** How many times each key was cleared or replaced whole, by any tab. Not backed up. */
const RESET_KEY = 'tafh:reset';

const DEBOUNCE_MS = 400;

const browser = () => typeof window !== 'undefined';

/** localStorage, or null during SSR and when reading it throws. Never writes a probe value. */
function backend(): Storage | null {
  if (!browser()) return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Values storage refused, per key; reads prefer them until a write to that key succeeds. */
const mem = new Map<string, string>();

function getRaw(key: string): string | null {
  const kept = mem.get(key);
  if (kept !== undefined) return kept;
  try {
    return backend()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

let warned = false;
/**
 * The first write storage refuses on a page says so, through Toast.svelte: it is kept in memory
 * and lost when the page is left (CO2-01). Once per page, not per write.
 */
function warnUnsaved() {
  if (warned) return;
  warned = true;
  toast('info', 'This device is not saving changes. They last until you leave this page.');
}

/** Writes unless the same text is already stored. `memory` when storage refused it. */
function put(key: string, value: unknown): 'same' | 'written' | 'memory' {
  if (!browser()) return 'memory';
  const raw = JSON.stringify(value);
  if (getRaw(key) === raw) return 'same';
  const s = backend();
  if (s) {
    try {
      s.setItem(key, raw);
      mem.delete(key);
      return 'written';
    } catch {
      /* quota or blocked storage: keep it in memory for this page */
    }
  }
  mem.set(key, raw);
  warnUnsaved();
  return 'memory';
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Reads a key as JSON. Returns `fallback` during SSR, when storage throws, when the value is
 * missing or unparsable, or when `isShape` rejects it. Reads `legacyKey` when `key` is absent.
 */
export function readJson<T>(
  key: string,
  fallback: T,
  opts: { legacyKey?: string | undefined; isShape?: (v: unknown) => v is T } = {},
): T {
  if (!browser()) return fallback;
  let raw = getRaw(key);
  if (raw === null && opts.legacyKey) raw = getRaw(opts.legacyKey);
  if (raw === null) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    return !opts.isShape || opts.isShape(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

/** The default cleaner: keeps everything but `null`, which JSON can hold and no store writes. */
const keepValue = <V>(v: unknown): V | undefined =>
  v === null || v === undefined ? undefined : (v as V);

/**
 * A map-shaped key (status, setup, verify): a plain object, never an array. Each entry goes through
 * `clean`, which returns the entry to keep or undefined to drop it (by default only `null` is
 * dropped; the stores pass status-io's cleaners, which also tidy the shape). A damaged or hand-edited
 * entry is dropped rather than thrown on, so it breaks no island that reads the key (CO3-01); the
 * key's next write leaves it out.
 */
export function readEntries<V>(
  key: string,
  legacyKey?: string,
  clean: (key: string, v: unknown) => V | undefined = (_k, v) => keepValue<V>(v),
): Entries<V> {
  const raw = readJson<Entries<unknown>>(key, {}, { legacyKey, isShape: isRecord });
  const out: Entries<V> = {};
  for (const [k, v] of Object.entries(raw)) {
    const c = clean(k, v);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

/** A list key (recent, viewed), cut to `max`. Items `clean` drops (by default `null`) are left out. */
export function readList<T>(
  key: string,
  max: number,
  clean: (v: unknown) => T | undefined = keepValue,
): T[] {
  const out: T[] = [];
  for (const v of readJson<unknown[]>(key, [], {
    isShape: (x): x is unknown[] => Array.isArray(x),
  })) {
    const c = clean(v);
    if (c !== undefined) out.push(c);
  }
  return out.slice(0, max);
}

// Watchers ------------------------------------------------------------------------------------

const watchers = new Map<string, Set<() => void>>();

function notify(key: string) {
  for (const cb of [...(watchers.get(key) ?? [])]) cb();
}

/**
 * Calls `cb` after this page writes `key` and after an outside change: another tab's `storage`
 * event, a `pageshow` from the back/forward cache, the page becoming visible. A no-op during SSR.
 */
export function watch(key: string, cb: () => void): () => void {
  if (!browser()) return () => {};
  listen();
  const set = watchers.get(key) ?? new Set();
  watchers.set(key, set);
  set.add(cb);
  return () => set.delete(cb);
}

/** Flushes local edits first, so a fresh read never reverts a field being typed in. */
function resync(key?: string) {
  flush();
  for (const k of key === undefined ? [...watchers.keys()] : [key]) notify(k);
}

let listening = false;
function listen() {
  if (listening || !browser()) return;
  listening = true;
  // Fields are read as plain properties, so tests can dispatch plain Events.
  window.addEventListener('pagehide', () => flush());
  window.addEventListener('pageshow', (e) => {
    if ((e as PageTransitionEvent).persisted) resync();
  });
  window.addEventListener('storage', (e) => {
    const { key, storageArea } = e as StorageEvent;
    const s = backend();
    if (!s || storageArea !== s) return;
    // Another tab could write, so storage holds its value again, not this page's refused one.
    if (key === null) mem.clear();
    else mem.delete(key);
    resync(key ?? undefined);
  });
  // Phones fire `hidden` before `pagehide`, and iOS fires it for the app switcher (swipe-kill).
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
      else resync();
    });
}

// Deferred entry writes -----------------------------------------------------------------------

interface Pending {
  key: string;
  sub: string;
  /** Each fn with the key's reset count when it was queued; a later reset drops it. */
  fns: { fn: Fn<unknown>; gen: number }[];
  legacyKey?: string | undefined;
  timer: ReturnType<typeof setTimeout>;
}
const pending = new Map<string, Pending>();
const slot = (key: string, sub: string) => `${key}\u0000${sub}`;

/** Removes the queued writes for all keys or one key, and stops their timers. */
function take(key?: string): Pending[] {
  const out: Pending[] = [];
  for (const [id, p] of pending) {
    if (key !== undefined && p.key !== key) continue;
    clearTimeout(p.timer);
    pending.delete(id);
    out.push(p);
  }
  return out;
}

function apply<V>(map: Entries<V>, sub: string, fns: Fn<V>[]) {
  let v = map[sub];
  for (const fn of fns) v = fn(v);
  if (v === undefined) delete map[sub];
  else map[sub] = v;
}

/** How many times `key` was cleared or replaced whole, by any tab; 0 when never. */
function resetGen(key: string): number {
  const gen = readJson<Record<string, unknown>>(RESET_KEY, {}, { isShape: isRecord })[key];
  return typeof gen === 'number' ? gen : 0;
}

/** Counts `key` as cleared once more. Written before the value, so other tabs see it first. */
function stampReset(key: string) {
  const all = readJson<Record<string, unknown>>(RESET_KEY, {}, { isShape: isRecord });
  put(RESET_KEY, { ...all, [key]: resetGen(key) + 1 });
}

/**
 * One read and one write for `key`: the queued fns in call order, then `extra`. A fn queued before
 * another tab cleared or replaced the key is dropped: it edits an entry that is gone.
 */
function commit<V>(
  key: string,
  queued: Pending[],
  legacyKey: string | undefined,
  extra?: [string, Fn<V>],
): { map: Entries<V>; wrote: boolean } {
  const map = readEntries<V>(key, legacyKey ?? queued.find((p) => p.legacyKey)?.legacyKey);
  const gen = queued.length ? resetGen(key) : 0;
  for (const p of queued) {
    const fns = p.fns.filter((q) => q.gen === gen).map((q) => q.fn as Fn<V>);
    apply(map, p.sub, fns);
  }
  if (extra) apply(map, extra[0], [extra[1]]);
  const wrote = put(key, map) === 'written';
  notify(key);
  return { map, wrote };
}

/**
 * Runs queued deferred writes now: all of them, or those for one key. Always the whole key, never
 * one entry: the watchers re-read the key after the write, and an entry still queued would be
 * missing from that read, so the field being typed in would lose its text. Never asks to keep
 * storage (a timer or `pagehide` has no user activation); a change handler that flushes calls
 * requestPersist itself.
 */
export function flush(key?: string) {
  const byKey = new Map<string, Pending[]>();
  for (const p of take(key)) byKey.set(p.key, [...(byKey.get(p.key) ?? []), p]);
  for (const [k, queued] of byKey) commit(k, queued, undefined);
}

/**
 * Queues `fn` for one entry and writes it after `ms` of quiet (trailing; each call restarts the
 * timer), together with the other entries queued for that key. Several fns for one entry compose
 * in call order. It does not touch any store state: the caller applies `fn` to its own state for
 * the view.
 */
export function deferEntry<V>(
  key: string,
  sub: string,
  fn: Fn<V>,
  opts: { legacyKey?: string | undefined; ms?: number } = {},
) {
  if (!browser()) return;
  listen();
  const timer = setTimeout(() => flush(key), opts.ms ?? DEBOUNCE_MS);
  const queued = { fn: fn as Fn<unknown>, gen: resetGen(key) };
  const p = pending.get(slot(key, sub));
  if (p) {
    clearTimeout(p.timer);
    p.fns.push(queued);
    p.timer = timer;
  } else
    pending.set(slot(key, sub), {
      key,
      sub,
      fns: [queued],
      legacyKey: opts.legacyKey,
      timer,
    });
}

/**
 * Read-modify-write of one entry: runs every queued fn for `key` first (so a tap never drops a
 * note typed a moment ago), re-reads `key`, applies `fn` (undefined deletes the entry), writes,
 * notifies the watchers and returns the fresh map.
 */
export function updateEntry<V>(
  key: string,
  sub: string,
  fn: Fn<V>,
  legacyKey?: string,
): Entries<V> {
  const { map, wrote } = commit(key, take(key), legacyKey, [sub, fn]);
  if (wrote) keep(key);
  return map;
}

/** Read-modify-write of a whole key (a list): flush, fresh read, `fn`, write, notify. */
export function updateJson<T>(
  key: string,
  fallback: T,
  fn: (cur: T) => T,
  opts: { legacyKey?: string | undefined; isShape?: (v: unknown) => v is T } = {},
): T {
  flush(key);
  const next = fn(readJson(key, fallback, opts));
  if (put(key, next) === 'written') keep(key);
  notify(key);
  return next;
}

/**
 * Whole-value write, for Clear and import. Drops the queued writes for `key` first, so a late note
 * cannot bring back a cleared entry. With `reset` (Clear, import-replace) it also stamps the key,
 * so another tab drops the writes it queued before now. False when the value is kept in memory only.
 */
export function writeJson(key: string, value: unknown, opts: { reset?: boolean } = {}): boolean {
  take(key);
  if (opts.reset) stampReset(key);
  const r = put(key, value);
  if (r === 'written') keep(key);
  notify(key);
  return r !== 'memory';
}

// Preferences ---------------------------------------------------------------------------------

/**
 * The display preferences: the theme, the reading text size and the manual's fit. Short strings
 * stored as they are, not JSON, because inline scripts in Base.astro and two pages read them
 * before the first paint. Not backed up and not watched: a page reads them once.
 */
export const PREF_KEYS = {
  theme: 'tafh:theme',
  text: 'tafh:text',
  fit: 'tafh:manual-fit',
} as const;
type Pref = keyof typeof PREF_KEYS;
const LEGACY_PREF: Partial<Record<Pref, string>> = {
  theme: LEGACY_KEYS.theme,
  fit: LEGACY_KEYS.fit,
};

/** A preference, else its value under the old key; null when unset or storage is blocked. */
export function readPref(p: Pref): string | null {
  const s = backend();
  const legacy = LEGACY_PREF[p];
  try {
    return s?.getItem(PREF_KEYS[p]) ?? (legacy ? s?.getItem(legacy) : null) ?? null;
  } catch {
    return null;
  }
}

/** Keeps a preference, or with null forgets it. Silent when storage refuses: it still applies here. */
export function writePref(p: Pref, value: string | null) {
  const s = backend();
  const legacy = LEGACY_PREF[p];
  try {
    if (legacy) s?.removeItem(legacy);
    if (value === null) s?.removeItem(PREF_KEYS[p]);
    else s?.setItem(PREF_KEYS[p], value);
  } catch {
    /* not kept: the next page uses the default */
  }
}

// Persistent storage --------------------------------------------------------------------------

function keep(key: string) {
  if (KEPT.has(key)) requestPersist();
}

let asked = false;

/**
 * Asks once per page load for storage the browser will not evict under pressure (PF-04). Only
 * after a user's write: Firefox shows a prompt, and on page load it would come back every time.
 * Chrome and Safari decide silently. Never throws.
 */
export function requestPersist() {
  if (asked || typeof navigator === 'undefined') return;
  const s = navigator.storage as StorageManager | undefined;
  if (!s || typeof s.persist !== 'function') return;
  asked = true;
  Promise.resolve()
    .then(() => (typeof s.persisted === 'function' ? s.persisted() : false))
    .then((kept) => kept || s.persist())
    .catch(() => {});
}

/**
 * Makes `target` equal `fresh`, assigning only the entries whose JSON differs, so a resync with
 * nothing new fires no signals in a reactive target.
 */
export function syncEntries<V>(target: Entries<V>, fresh: Entries<V>) {
  for (const k of Object.keys(target)) if (!Object.hasOwn(fresh, k)) delete target[k];
  for (const [k, v] of Object.entries(fresh))
    if (JSON.stringify(target[k]) !== JSON.stringify(v)) target[k] = v;
}
