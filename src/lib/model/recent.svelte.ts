/**
 * Recent diagnoses (spec §9.1), local to this device. Same shape as the status model: runes state
 * with localStorage behind it. Q16's default policy: at most 8 entries under `tafh:recent`; the
 * same normalised input moves to the top instead of repeating.
 */
import { nowIso } from '~/lib/status-io';

export interface RecentEntry {
  /** What was typed, trimmed. */
  input: string;
  /** "1 switch · 1 marked Fault" */
  summary: string;
  /** ISO timestamp of the last time it was recorded. */
  at: string;
}

const KEY = 'tafh:recent';
export const RECENT_MAX = 8;

function load(): RecentEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RecentEntry[]) : [];
    return Array.isArray(list) ? list.slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

const state = $state<{ items: RecentEntry[] }>({ items: load() });

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.items));
  } catch {
    /* private mode: keep in memory only */
  }
}

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
  persist();
}

export function clearRecent() {
  state.items = [];
  persist();
}
