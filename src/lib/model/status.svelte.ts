import type { ComponentStatus, Kind, StatusValue } from './types';

/**
 * Per-component test status, local to this device (M1: localStorage; M2 moves it behind a
 * StorageAdapter on Dexie). Reactive via Svelte 5 runes so every island sees the same state.
 */
const KEY = 'valvet:status';

function load(): Record<string, ComponentStatus> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
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
  const next: ComponentStatus = {
    id: key,
    status,
    note: note ?? prev?.note ?? '',
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain timestamp, not reactive state
    at: new Date().toISOString(),
  };
  if (!next.status && !next.note) delete state.items[key];
  else state.items[key] = next;
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

export const STATUS_LABEL: Record<StatusValue, string> = {
  ok: 'OK',
  fault: 'Fault',
  untested: 'Not tested',
};
