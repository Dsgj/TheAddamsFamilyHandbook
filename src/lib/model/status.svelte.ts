import type { ComponentStatus, Kind, StatusValue } from './types';
import { appendHistory, deserializeAll, merge, serialize } from '~/lib/status-io';
import { mergeSetupInto, replaceSetup, setupItems } from './setup.svelte';
export { shortDate } from '~/lib/status-io';

/**
 * Per-component test status, local to this device (M1: localStorage; M2 moves it behind a
 * StorageAdapter on Dexie). Reactive via Svelte 5 runes so every island sees the same state.
 * Each component keeps a short history of status changes as a service log.
 */
const KEY = 'tafh:status';
const LEGACY_KEY = 'valvet:status';

function load(): Record<string, ComponentStatus> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ComponentStatus>) : {};
  } catch {
    return {};
  }
}

const state = $state<{ items: Record<string, ComponentStatus> }>({ items: load() });

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.items));
  } catch {
    /* private mode: keep in memory only */
  }
}

export const statusKey = (kind: Kind, id: string) => `${kind}:${id}`;

export function getStatus(kind: Kind, id: string): ComponentStatus | undefined {
  return state.items[statusKey(kind, id)];
}

export function setStatus(kind: Kind, id: string, status: StatusValue | '', note?: string) {
  const key = statusKey(kind, id);
  const prev = state.items[key];
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain timestamp, not reactive state
  const at = new Date().toISOString();
  const changed = (prev?.status ?? '') !== status;
  const history = changed ? appendHistory(prev?.history, status, at) : prev?.history;
  const next: ComponentStatus = {
    id: key,
    status,
    note: note ?? prev?.note ?? '',
    at,
  };
  if (history?.length) next.history = history;
  if (!next.status && !next.note) {
    // Keep the log while something was ever recorded, so "Fixed" stays visible on the card.
    if (history?.length) state.items[key] = next;
    else delete state.items[key];
  } else state.items[key] = next;
  persist();
}

export function setNote(kind: Kind, id: string, note: string) {
  const key = statusKey(kind, id);
  const prev = state.items[key];
  setStatus(kind, id, prev?.status ?? '', note);
}

export function allStatuses(): ComponentStatus[] {
  return Object.values(state.items);
}

export function clearStatuses() {
  state.items = {};
  persist();
}

/** Pretty JSON of everything on this device (status and machine setup), for a backup file. */
export function exportStatuses(): string {
  return serialize(state.items, setupItems());
}

/**
 * Reads a backup. `merge` keeps the newer entry per component and setting (default); `replace`
 * drops what is on the device first. A file without a setup block leaves setup untouched.
 * Returns what the file held. Throws on invalid JSON.
 */
export function importStatuses(
  json: string,
  mode: 'merge' | 'replace' = 'merge',
): { components: number; settings: number } {
  const { items, setup } = deserializeAll(json);
  state.items = mode === 'replace' ? items : merge(state.items, items);
  persist();
  if (setup) {
    if (mode === 'replace') replaceSetup(setup);
    else mergeSetupInto(setup);
  }
  return { components: Object.keys(items).length, settings: Object.keys(setup ?? {}).length };
}

export const STATUS_LABEL: Record<StatusValue, string> = {
  ok: 'OK',
  fault: 'Fault',
  untested: 'Not tested',
};
