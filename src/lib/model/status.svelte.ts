import { untrack } from 'svelte';
import { componentKey } from '~/lib/model/key';
import type { ComponentStatus, Kind, StatusValue } from './types';
import { cleanStatus, nextStatus, nowIso } from '~/lib/status-io';
import {
  BACKUP_KEYS,
  deferEntry,
  flush,
  LEGACY_KEYS,
  readEntries,
  requestPersist,
  syncEntries,
  updateEntry,
  watch,
  writeJson,
} from '~/lib/storage';

/**
 * Per-component test status, local to this device (M1: localStorage through lib/storage.ts; M2
 * moves it to Dexie behind the same module). Reactive via Svelte 5 runes so every island sees the
 * same state. Each component keeps a short history of status changes as a service log. Writes go
 * entry by entry to fresh storage; the state follows storage through the watcher. The labels are
 * copy.ts STATUS_LABEL and the backup file is model/backup.ts (audit AR2-13).
 */
const KEY = BACKUP_KEYS.status;
const LEGACY_KEY = LEGACY_KEYS.status;

const read = () => readEntries<ComponentStatus>(KEY, LEGACY_KEY, cleanStatus);
const state = $state<{ items: Record<string, ComponentStatus> }>({ items: read() });

// Own writes and outside changes (another tab, a bfcache restore). Watchers run inside whatever
// wrote, which can be an effect, so nothing here subscribes it to the map.
if (typeof window !== 'undefined')
  watch(KEY, () => untrack(() => syncEntries(state.items, read())));

/** For the vanilla table enhancer: runs after every change to the statuses. */
export const watchStatus = (cb: () => void) => watch(KEY, cb);

export function getStatus(kind: Kind, id: string): ComponentStatus | undefined {
  return state.items[componentKey(kind, id)];
}

export function setStatus(kind: Kind, id: string, status: StatusValue | '', note?: string) {
  const key = componentKey(kind, id);
  updateEntry<ComponentStatus>(
    KEY,
    key,
    (cur) => nextStatus(key, cur, status, note, nowIso()),
    LEGACY_KEY,
  );
}

/**
 * Changes the note and keeps the status. With `defer` (typing), the view updates now and storage
 * after a short pause, or on pagehide; the status and time are taken when it is written.
 */
export function setNote(kind: Kind, id: string, note: string, opts: { defer?: boolean } = {}) {
  const key = componentKey(kind, id);
  const fn = (cur: ComponentStatus | undefined) =>
    nextStatus(key, cur, cur?.status ?? '', note, nowIso());
  if (!opts.defer) {
    updateEntry(KEY, key, fn, LEGACY_KEY);
    return;
  }
  const next = fn(untrack(() => $state.snapshot(state.items[key])));
  if (next) state.items[key] = next;
  else delete state.items[key];
  deferEntry(KEY, key, fn, { legacyKey: LEGACY_KEY });
}

/**
 * Writes the typed notes now (the field's change event) and asks once to keep storage. All of
 * them: the write re-reads the map, and a note still queued would be reverted in its field.
 */
export function saveNote() {
  flush(KEY);
  requestPersist();
}

export function allStatuses(): ComponentStatus[] {
  return Object.values(state.items);
}

export function clearStatuses() {
  writeJson(KEY, {}, { reset: true });
}
