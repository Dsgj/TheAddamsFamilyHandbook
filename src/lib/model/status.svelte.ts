import { untrack } from 'svelte';
import type { ComponentStatus, Kind, SetupEntry, StatusValue } from './types';
import {
  applyBackup,
  deserializeAll,
  lostEntries,
  nextStatus,
  nowIso,
  serialize,
  type Snapshot,
} from '~/lib/status-io';
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
export { shortDate } from '~/lib/status-io';

/**
 * Per-component test status, local to this device (M1: localStorage through lib/storage.ts; M2
 * moves it to Dexie behind the same module). Reactive via Svelte 5 runes so every island sees the
 * same state. Each component keeps a short history of status changes as a service log. Writes go
 * entry by entry to fresh storage; the state follows storage through the watcher.
 */
const KEY = BACKUP_KEYS.status;
/** Read-only fallback from before the rename. Never written or removed: Clear writes `{}`. */
const LEGACY_KEY = 'valvet:status';

const read = () => readEntries<ComponentStatus>(KEY, LEGACY_KEY);
const state = $state<{ items: Record<string, ComponentStatus> }>({ items: read() });

// Own writes and outside changes (another tab, a bfcache restore). Watchers run inside whatever
// wrote, which can be an effect, so nothing here subscribes it to the map.
if (typeof window !== 'undefined')
  watch(KEY, () => untrack(() => syncEntries(state.items, read())));

/** For the vanilla table enhancer: runs after every change to the statuses. */
export const watchStatus = (cb: () => void) => watch(KEY, cb);

export const statusKey = (kind: Kind, id: string) => `${kind}:${id}`;

export function getStatus(kind: Kind, id: string): ComponentStatus | undefined {
  return state.items[statusKey(kind, id)];
}

export function setStatus(kind: Kind, id: string, status: StatusValue | '', note?: string) {
  const key = statusKey(kind, id);
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
  const key = statusKey(kind, id);
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

/** Pretty JSON of everything on this device (status, machine setup, Verify ticks), for a backup. */
export function exportStatuses(): string {
  flush();
  return serialize(
    read(),
    readEntries<SetupEntry>(BACKUP_KEYS.setup),
    readEntries<string>(BACKUP_KEYS.verify),
  );
}

/** Everything a backup covers, fresh from storage. */
const snapshot = (): Snapshot => ({
  items: read(),
  setup: readEntries<SetupEntry>(BACKUP_KEYS.setup),
  verify: readEntries<string>(BACKUP_KEYS.verify),
});

/**
 * How many entries on this device a replace with `json` would remove or overwrite. Writes nothing;
 * throws the same BackupError importStatuses would.
 */
export function replaceLoss(json: string): number {
  flush();
  const cur = snapshot();
  return lostEntries(cur, applyBackup(cur, deserializeAll(json), 'replace'));
}

/**
 * Reads a backup. `merge` keeps the newer entry per component, setting and check (default);
 * `replace` swaps what the file carries. A file without a setup or verify block leaves that part
 * alone. The whole file is checked before anything is written: a BackupError leaves the device as
 * it was. Returns what the file held.
 */
export function importStatuses(
  json: string,
  mode: 'merge' | 'replace' = 'merge',
): { components: number; settings: number; verified: number } {
  flush();
  const b = deserializeAll(json);
  const cur = snapshot();
  const next = applyBackup(cur, b, mode);
  const writes: [string, unknown, unknown][] = [
    [KEY, cur.items, next.items],
    [BACKUP_KEYS.setup, cur.setup, next.setup],
    [BACKUP_KEYS.verify, cur.verify, next.verify],
  ];
  for (const [key, was, now] of writes)
    if (JSON.stringify(was) !== JSON.stringify(now))
      writeJson(key, now, { reset: mode === 'replace' });
  return {
    components: Object.keys(b.items).length,
    settings: Object.keys(b.setup ?? {}).length,
    verified: Object.keys(b.verify ?? {}).length,
  };
}

export const STATUS_LABEL: Record<StatusValue, string> = {
  ok: 'OK',
  fault: 'Fault',
  untested: 'Not tested',
};
