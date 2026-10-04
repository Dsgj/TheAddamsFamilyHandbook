/**
 * Recent diagnoses (spec §9.1) and recently viewed components (spec §9.5), local to this device.
 * Same shape as the status model: runes state following lib/storage.ts. Q16's default policy:
 * at most 8 entries per list; the same entry moves to the top instead of repeating.
 */
import { untrack } from 'svelte';
import { nowIso } from '~/lib/status-io';
import { KEYS, readList, updateJson, watch } from '~/lib/storage';
import type { Kind } from '~/lib/model/types';

interface RecentEntry {
  /** What was typed, tidied by `tidyInput`: a pasted report keeps its lines. */
  input: string;
  /** "1 switch · 1 marked Fault" */
  summary: string;
  /** ISO timestamp of the last time it was recorded. */
  at: string;
}

interface ViewedEntry {
  kind: Kind;
  id: string;
  /** "32", "L13", "SOL 10" */
  code: string;
  name: string;
  /** "Switch · matrix column 3, row 2" */
  sub: string;
  at: string;
}

const KEY = KEYS.recent;
const VIEWED_KEY = KEYS.viewed;
const RECENT_MAX = 8;

const isList = <T>(v: unknown): v is T[] => Array.isArray(v);
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string';
/** An entry as this device wrote it. Anything else in a list (a null, a hand-edited line) is dropped (CO3-01). */
const asRecent = (v: unknown): RecentEntry | undefined =>
  isRecord(v) && str(v.input) && str(v.summary) && str(v.at)
    ? (v as unknown as RecentEntry)
    : undefined;
const asViewed = (v: unknown): ViewedEntry | undefined =>
  isRecord(v) && str(v.kind) && str(v.id) && str(v.code) && str(v.name) && str(v.at)
    ? (v as unknown as ViewedEntry)
    : undefined;
type Clean<T> = (v: unknown) => T | undefined;
const load = <T>(key: string, clean: Clean<T>) => readList<T>(key, RECENT_MAX, clean);

const state = $state<{ items: RecentEntry[] }>({ items: load(KEY, asRecent) });
const viewed = $state<{ items: ViewedEntry[] }>({ items: load(VIEWED_KEY, asViewed) });

/** Replaces the list only when storage holds something else, so a resync fires nothing new. */
function follow<T>(list: { items: T[] }, key: string, clean: Clean<T>) {
  untrack(() => {
    const fresh = load(key, clean);
    if (JSON.stringify(list.items) !== JSON.stringify(fresh)) list.items = fresh;
  });
}
if (typeof window !== 'undefined') {
  watch(KEY, () => follow(state, KEY, asRecent));
  watch(VIEWED_KEY, () => follow(viewed, VIEWED_KEY, asViewed));
}

/** Whitespace collapsed, upper-cased: "check switch 32" and "CHECK  SWITCH 32" are one entry. */
export const normalizeInput = (input: string) => input.trim().replace(/\s+/g, ' ').toUpperCase();

export function recentEntries(): RecentEntry[] {
  return state.items;
}

/**
 * What Recent keeps of an input: each line trimmed with its runs of spaces collapsed, blank lines
 * dropped. The lines stay, since a pasted test report is read line by line (CO2-02).
 */
export const tidyInput = (input: string) =>
  input
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n');

// A search, a component view and a handbook position are the app's bookkeeping, not the user's
// writes: refused, they stay in memory without the "not saving" toast (CO3-04).
export function recordRecent(input: string, summary: string, at = nowIso()) {
  const text = tidyInput(input);
  if (!text) return;
  const norm = normalizeInput(text);
  updateJson<RecentEntry[]>(
    KEY,
    [],
    (fresh) =>
      [
        { input: text, summary, at },
        ...fresh.filter((e) => asRecent(e) && normalizeInput(e.input) !== norm),
      ].slice(0, RECENT_MAX),
    { isShape: isList, quiet: true },
  );
}

export function clearRecent() {
  updateJson<RecentEntry[]>(KEY, [], () => []);
}

/** The components opened on this device, newest first. */
export function viewedEntries(): ViewedEntry[] {
  return viewed.items;
}

export function recordViewed(entry: Omit<ViewedEntry, 'at'>, at = nowIso()) {
  updateJson<ViewedEntry[]>(
    VIEWED_KEY,
    [],
    (fresh) =>
      [
        { ...entry, at },
        ...fresh.filter((v) => asViewed(v) && !(v.kind === entry.kind && v.id === entry.id)),
      ].slice(0, RECENT_MAX),
    { isShape: isList, quiet: true },
  );
}

export function clearViewed() {
  updateJson<ViewedEntry[]>(VIEWED_KEY, [], () => []);
}
