import type { SetupEntry } from './types';
import { mergeSetup } from '~/lib/status-io';

/**
 * What the machine is set to, per setup item (see src/data/setup.ts), local to this device.
 * Same shape as the status model: runes state, localStorage behind it, part of the backup file.
 */
const KEY = 'tafh:setup';

function load(): Record<string, SetupEntry> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, SetupEntry>) : {};
  } catch {
    return {};
  }
}

const state = $state<{ items: Record<string, SetupEntry> }>({ items: load() });

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state.items));
  } catch {
    /* private mode: keep in memory only */
  }
}

export function getSetup(id: string): SetupEntry | undefined {
  return state.items[id];
}

function put(id: string, patch: Partial<SetupEntry>) {
  const prev = state.items[id];
  const next: SetupEntry = {
    value: patch.value ?? prev?.value ?? '',
    done: patch.done ?? prev?.done ?? false,
    at: new Date().toISOString(),
  };
  if (!next.value && !next.done) delete state.items[id];
  else state.items[id] = next;
  persist();
}

export function setValue(id: string, value: string) {
  put(id, { value });
}

export function setDone(id: string, done: boolean) {
  put(id, { done });
}

/** The raw record, for the backup file. */
export function setupItems(): Record<string, SetupEntry> {
  return state.items;
}

export function doneCount(ids: string[]): number {
  return ids.filter((id) => state.items[id]?.done).length;
}

export function replaceSetup(items: Record<string, SetupEntry>) {
  state.items = items;
  persist();
}

export function mergeSetupInto(items: Record<string, SetupEntry>) {
  state.items = mergeSetup(state.items, items);
  persist();
}

export function clearSetup() {
  state.items = {};
  persist();
}
