/**
 * Recent diagnoses (spec §9.1) and recently viewed components (spec §9.5), local to this device.
 * Same shape as the status model: runes state with localStorage behind it. Q16's default policy:
 * at most 8 entries per list; the same entry moves to the top instead of repeating.
 */
import { nowIso } from '~/lib/status-io';
import type { Kind } from '~/lib/model/types';

export interface RecentEntry {
  /** What was typed, trimmed. */
  input: string;
  /** "1 switch · 1 marked Fault" */
  summary: string;
  /** ISO timestamp of the last time it was recorded. */
  at: string;
}

export interface ViewedEntry {
  kind: Kind;
  id: string;
  /** "32", "L13", "SOL 10" */
  code: string;
  name: string;
  /** "Switch · matrix column 3, row 2" */
  sub: string;
  at: string;
}

const KEY = 'tafh:recent';
const VIEWED_KEY = 'tafh:viewed';
export const RECENT_MAX = 8;

function load<T>(key: string): T[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    const list = raw ? (JSON.parse(raw) as T[]) : [];
    return Array.isArray(list) ? list.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: keep in memory only */
  }
}

const state = $state<{ items: RecentEntry[] }>({ items: load<RecentEntry>(KEY) });
const viewed = $state<{ items: ViewedEntry[] }>({ items: load<ViewedEntry>(VIEWED_KEY) });

/** Whitespace collapsed, upper-cased: "check switch 32" and "CHECK  SWITCH 32" are one entry. */
export const normalizeInput = (input: string) => input.trim().replace(/\s+/g, ' ').toUpperCase();

export function recentEntries(): RecentEntry[] {
  return state.items;
}

export function recordRecent(input: string, summary: string, at = nowIso()) {
  const text = input.trim().replace(/\s+/g, ' ');
  if (!text) return;
  const norm = normalizeInput(text);
  const rest = state.items.filter((e) => normalizeInput(e.input) !== norm);
  state.items = [{ input: text, summary, at }, ...rest].slice(0, RECENT_MAX);
  persist(KEY, state.items);
}

export function clearRecent() {
  state.items = [];
  persist(KEY, state.items);
}

/** The components opened on this device, newest first. */
export function viewedEntries(): ViewedEntry[] {
  return viewed.items;
}

export function recordViewed(entry: Omit<ViewedEntry, 'at'>, at = nowIso()) {
  const rest = viewed.items.filter((v) => !(v.kind === entry.kind && v.id === entry.id));
  viewed.items = [{ ...entry, at }, ...rest].slice(0, RECENT_MAX);
  persist(VIEWED_KEY, viewed.items);
}
