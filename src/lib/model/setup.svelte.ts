import { untrack } from 'svelte';
import type { SetupEntry } from './types';
import { cleanSetup, nextSetup, nowIso } from '~/lib/status-io';
import {
  BACKUP_KEYS,
  deferEntry,
  flush,
  readEntries,
  requestPersist,
  syncEntries,
  updateEntry,
  watch,
  writeJson,
} from '~/lib/storage';

/**
 * What the machine is set to, per setup item (see src/data/setup.ts), local to this device.
 * Same shape as the status model: runes state following lib/storage.ts, part of the backup file.
 */
const KEY = BACKUP_KEYS.setup;

const read = () => readEntries<SetupEntry>(KEY, undefined, cleanSetup);
const state = $state<{ items: Record<string, SetupEntry> }>({ items: read() });

if (typeof window !== 'undefined')
  watch(KEY, () => untrack(() => syncEntries(state.items, read())));

export function getSetup(id: string): SetupEntry | undefined {
  return state.items[id];
}

/**
 * With `defer` (typing), the view updates now and storage after a short pause, or on pagehide;
 * the tick and time are taken when it is written.
 */
export function setValue(id: string, value: string, opts: { defer?: boolean } = {}) {
  const fn = (cur: SetupEntry | undefined) => nextSetup(cur, { value }, nowIso());
  if (!opts.defer) {
    updateEntry(KEY, id, fn);
    return;
  }
  const next = fn(untrack(() => $state.snapshot(state.items[id])));
  if (next) state.items[id] = next;
  else delete state.items[id];
  deferEntry(KEY, id, fn);
}

/** Writes the typed values now (the field's change event) and asks once to keep storage. */
export function saveValue() {
  flush(KEY);
  requestPersist();
}

export function setDone(id: string, done: boolean) {
  updateEntry<SetupEntry>(KEY, id, (cur) => nextSetup(cur, { done }, nowIso()));
}

/** The raw record, for the device data counts. */
export function setupItems(): Record<string, SetupEntry> {
  return state.items;
}

export function doneCount(ids: string[]): number {
  return ids.filter((id) => state.items[id]?.done).length;
}

export function clearSetup() {
  writeJson(KEY, {}, { reset: true });
}
